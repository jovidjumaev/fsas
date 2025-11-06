const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const router = express.Router();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function toNumber(value) {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTimestamp(value) {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function buildQuizInsights(enrollments = [], quizSessions = [], quizQuestions = [], materials = []) {
  const studentProfiles = enrollments.map((enrollment) => {
    const studentRecord = enrollment.students || {};
    const userRecord = studentRecord.users || {};

    // The enrollments table stores the student_id as the student's user_id
    const userId = studentRecord.user_id || enrollment.student_id;

    return {
      enrollmentId: enrollment.id,
      studentId: userId,
      status: enrollment.status,
      studentNumber: studentRecord.student_id || null,
      firstName: userRecord.first_name || '',
      lastName: userRecord.last_name || '',
      email: userRecord.email || '',
    };
  });

  const sessionsByStudent = new Map();
  const materialSummaries = new Map();

  const materialLookup = new Map(
    (materials || []).map((material) => [
      material.id,
      {
        id: material.id,
        fileName: material.file_name || 'Untitled material',
        uploadedAt: material.uploaded_at || null,
      },
    ])
  );

  // Pre-compute question difficulty per material
  const questionStatsByMaterial = new Map();
  (quizQuestions || []).forEach((question) => {
    if (!question || !question.material_id) {
      return;
    }

    const key = question.material_id;
    const existing = questionStatsByMaterial.get(key) || {
      totalQuestions: 0,
      totalAttempts: 0,
      totalCorrectAnswers: 0,
    };

    existing.totalQuestions += 1;
    existing.totalAttempts += toNumber(question.times_answered);
    existing.totalCorrectAnswers += toNumber(question.correct_answers);

    questionStatsByMaterial.set(key, existing);
  });

  // Organize sessions by student and material
  (quizSessions || []).forEach((session) => {
    if (!session || !session.student_id) {
      return;
    }

    const studentId = session.student_id;
    const studentSessions = sessionsByStudent.get(studentId) || [];
    studentSessions.push(session);
    sessionsByStudent.set(studentId, studentSessions);

    const materialId = session.material_id;
    if (!materialId) {
      return;
    }

    const materialInfo =
      materialSummaries.get(materialId) || {
        materialId,
        fileName: materialLookup.get(materialId)?.fileName || 'Unknown material',
        uploadedAt: materialLookup.get(materialId)?.uploadedAt || null,
        totalAttempts: 0,
        completedAttempts: 0,
        uniqueStudents: new Set(),
        totalScore: 0,
        maxScore: null,
        minScore: null,
        latestCompletedAt: null,
        startedAttempts: 0,
      };

    materialInfo.totalAttempts += 1;

    if (session.is_completed) {
      materialInfo.completedAttempts += 1;
      materialInfo.totalScore += toNumber(session.score_percentage);

      const score = toNumber(session.score_percentage);
      materialInfo.maxScore =
        materialInfo.maxScore === null ? score : Math.max(materialInfo.maxScore, score);
      materialInfo.minScore =
        materialInfo.minScore === null ? score : Math.min(materialInfo.minScore, score);

      const completedAtTs = getTimestamp(session.completed_at);
      const previousTs = getTimestamp(materialInfo.latestCompletedAt);
      if (completedAtTs && (!previousTs || completedAtTs > previousTs)) {
        materialInfo.latestCompletedAt = session.completed_at;
      }
    }

    if (session.started_at || session.startedAt || session.is_completed) {
      materialInfo.startedAttempts += 1;
    }

    materialInfo.uniqueStudents.add(studentId);
    materialSummaries.set(materialId, materialInfo);
  });

  const studentSummaries = studentProfiles.map((profile) => {
    const sessions = sessionsByStudent.get(profile.studentId) || [];

    const latestSession = sessions
      .slice()
      .sort((a, b) => {
        const aTs = getTimestamp(a.completed_at) || getTimestamp(a.started_at) || 0;
        const bTs = getTimestamp(b.completed_at) || getTimestamp(b.started_at) || 0;
        return bTs - aTs;
      })[0];

    const attemptsByMaterial = new Map();
    sessions.forEach((session) => {
      if (!session.material_id) {
        return;
      }

      const existing = attemptsByMaterial.get(session.material_id);
      const referenceTs =
        getTimestamp(session.completed_at) || getTimestamp(session.started_at) || 0;

      if (!existing || referenceTs > existing._ts) {
        attemptsByMaterial.set(session.material_id, {
          materialId: session.material_id,
          materialName: materialLookup.get(session.material_id)?.fileName || 'Unknown material',
          quizSessionId: session.id,
          totalQuestions: toNumber(session.total_questions),
          correctAnswers: toNumber(session.correct_answers),
          scorePercentage: toNumber(session.score_percentage),
          startedAt: session.started_at || session.startedAt || null,
          completedAt: session.completed_at || null,
          isCompleted: Boolean(session.is_completed),
          _ts: referenceTs,
        });
      }
    });

    const attempts = Array.from(attemptsByMaterial.values()).map((attempt) => {
      // Remove internal helper key before returning
      const { _ts, ...publicAttempt } = attempt;
      return publicAttempt;
    });

    const latestSummary = latestSession
      ? {
          quizSessionId: latestSession.id,
          materialId: latestSession.material_id,
          materialName:
            materialLookup.get(latestSession.material_id)?.fileName || 'Unknown material',
          scorePercentage: toNumber(latestSession.score_percentage),
          correctAnswers: toNumber(latestSession.correct_answers),
          totalQuestions: toNumber(latestSession.total_questions),
          startedAt: latestSession.started_at || latestSession.startedAt || null,
          completedAt: latestSession.completed_at || null,
          isCompleted: Boolean(latestSession.is_completed),
        }
      : null;

    return {
      ...profile,
      hasAttempted: attempts.length > 0,
      attempts,
      latestAttempt: latestSummary,
    };
  });

  const totalStudents = studentProfiles.length;
  const studentsAttempted = studentSummaries.filter((summary) => summary.hasAttempted).length;

  const completedSessions = (quizSessions || []).filter((session) => session.is_completed);
  const averageScore =
    completedSessions.length > 0
      ? Math.round(
          (completedSessions.reduce(
            (sum, session) => sum + toNumber(session.score_percentage),
            0
          ) /
            completedSessions.length) *
            100
        ) / 100
      : null;

  const materialInsights = Array.from(materialSummaries.values()).map((material) => {
    const questionStats = questionStatsByMaterial.get(material.materialId) || {
      totalQuestions: 0,
      totalAttempts: 0,
      totalCorrectAnswers: 0,
    };

    const averageScore =
      material.completedAttempts > 0
        ? Math.round((material.totalScore / material.completedAttempts) * 100) / 100
        : null;

    const accuracyRate =
      questionStats.totalAttempts > 0
        ? Math.round((questionStats.totalCorrectAnswers / questionStats.totalAttempts) * 10000) /
          100
        : null;

    return {
      materialId: material.materialId,
      materialName: material.fileName,
      uploadedAt: material.uploadedAt,
      totalAttempts: material.totalAttempts,
      startedAttempts: material.startedAttempts,
      completedAttempts: material.completedAttempts,
      studentsAttempted: material.uniqueStudents.size,
      studentsNotAttempted: Math.max(totalStudents - material.uniqueStudents.size, 0),
      averageScore,
      maxScore: material.maxScore,
      minScore: material.minScore,
      lastCompletedAt: material.latestCompletedAt,
      averageQuestionAccuracy: accuracyRate,
      questionSamples: {
        totalQuestions: questionStats.totalQuestions,
        totalQuestionAttempts: questionStats.totalAttempts,
      },
    };
  });

  return {
    totals: {
      totalStudents,
      studentsAttempted,
      studentsNotAttempted: Math.max(totalStudents - studentsAttempted, 0),
      averageScore,
      totalCompletedAttempts: completedSessions.length,
    },
    students: studentSummaries,
    materials: materialInsights,
  };
}

router.get(
  '/api/professors/:professorId/classes/:classId/ai/quiz-insights',
  async (req, res) => {
    try {
      const { professorId, classId } = req.params;

      if (!professorId || !classId) {
        return res.status(400).json({
          success: false,
          error: 'Professor ID and class ID are required',
        });
      }

      // Validate class ownership
      const { data: classInstance, error: classError } = await supabase
        .from('class_instances')
        .select('id, professor_id')
        .eq('id', classId)
        .single();

      if (classError) {
        console.error('❌ Error fetching class instance:', classError);
        return res.status(500).json({
          success: false,
          error: 'Failed to verify class ownership',
        });
      }

      if (!classInstance) {
        return res.status(404).json({
          success: false,
          error: 'Class instance not found',
        });
      }

      if (classInstance.professor_id !== professorId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - professor does not own this class',
        });
      }

      // Fetch enrollments with student/user information
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select(
          `
          id,
          student_id,
          status,
          students!inner(
            student_id,
            user_id,
            users!inner(
              first_name,
              last_name,
              email
            )
          )
        `
        )
        .eq('class_instance_id', classId)
        .in('status', ['active', 'completed']);

      if (enrollmentError) {
        console.error('❌ Error fetching enrollments:', enrollmentError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch enrollments',
        });
      }

      // Fetch class materials
      const { data: materials, error: materialsError } = await supabase
        .from('class_materials')
        .select('id, file_name, uploaded_at')
        .eq('class_instance_id', classId);

      if (materialsError) {
        console.error('❌ Error fetching materials:', materialsError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch class materials',
        });
      }

      // Fetch quiz sessions for this class
      const { data: quizSessions, error: sessionsError } = await supabase
        .from('student_quiz_sessions')
        .select(
          `
          id,
          student_id,
          class_instance_id,
          material_id,
          total_questions,
          correct_answers,
          score_percentage,
          time_taken_seconds,
          started_at,
          completed_at,
          is_completed,
          class_materials(
            id,
            file_name
          )
        `
        )
        .eq('class_instance_id', classId);

      if (sessionsError) {
        console.error('❌ Error fetching quiz sessions:', sessionsError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch quiz sessions',
        });
      }

      // Fetch quiz question stats for this class
      const { data: quizQuestions, error: questionsError } = await supabase
        .from('student_quiz_questions')
        .select('id, student_id, material_id, times_answered, correct_answers')
        .eq('class_instance_id', classId);

      if (questionsError) {
        console.error('❌ Error fetching quiz questions:', questionsError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch quiz question statistics',
        });
      }

      const insights = buildQuizInsights(enrollments, quizSessions, quizQuestions, materials);

      return res.json({
        success: true,
        data: {
          classId,
          professorId,
          generatedAt: new Date().toISOString(),
          ...insights,
        },
      });
    } catch (error) {
      console.error('❌ Quiz insights error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
);

module.exports = {
  router,
  buildQuizInsights,
};
