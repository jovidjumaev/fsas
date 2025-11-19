const { createLogger } = require('./lib/logger');
const logger = createLogger('Backend');

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
        recentAttempts: [],
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

    materialInfo.recentAttempts.push({
      quizSessionId: session.id,
      studentId,
      startedAt: session.started_at || session.startedAt || null,
      completedAt: session.completed_at || null,
      isCompleted: Boolean(session.is_completed),
      scorePercentage: session.is_completed ? toNumber(session.score_percentage) : null,
      correctAnswers: session.is_completed ? toNumber(session.correct_answers) : null,
      totalQuestions: toNumber(session.total_questions),
    });

    if (session.is_completed) {
      materialInfo.uniqueStudents.add(studentId);
    }

    if (session.started_at || session.startedAt || session.is_completed) {
      materialInfo.startedAttempts += 1;
    }

    materialSummaries.set(materialId, materialInfo);
  });

  const studentSummaries = studentProfiles.map((profile) => {
    const sessions = sessionsByStudent.get(profile.studentId) || [];
    const sortedSessions = sessions
      .slice()
      .sort((a, b) => {
        const aTs = getTimestamp(a.completed_at) || getTimestamp(a.started_at) || 0;
        const bTs = getTimestamp(b.completed_at) || getTimestamp(b.started_at) || 0;
        return bTs - aTs;
      });

    const attemptHistory = sortedSessions.map((session) => ({
      quizSessionId: session.id,
      materialId: session.material_id,
      materialName: materialLookup.get(session.material_id)?.fileName || 'Unknown material',
      scorePercentage: session.is_completed ? toNumber(session.score_percentage) : null,
      correctAnswers: session.is_completed ? toNumber(session.correct_answers) : null,
      totalQuestions: toNumber(session.total_questions),
      startedAt: session.started_at || session.startedAt || null,
      completedAt: session.completed_at || null,
      isCompleted: Boolean(session.is_completed),
    }));

    const attemptsByMaterial = new Map();
    attemptHistory.forEach((attempt) => {
      if (!attempt.materialId) {
        return;
      }

      const referenceTs =
        getTimestamp(attempt.completedAt) || getTimestamp(attempt.startedAt) || 0;
      const existing = attemptsByMaterial.get(attempt.materialId);
      if (!existing || referenceTs > existing._ts) {
        attemptsByMaterial.set(attempt.materialId, {
          ...attempt,
          _ts: referenceTs,
        });
      }
    });

    const materialSnapshots = Array.from(attemptsByMaterial.values()).map((attempt) => {
      const { _ts, ...publicAttempt } = attempt;
      return publicAttempt;
    });

    const latestCompleted = attemptHistory.find((attempt) => attempt.isCompleted);
    const latestEntry = latestCompleted || attemptHistory[0] || null;

    const hasCompletedAttempt = attemptHistory.some((attempt) => attempt.isCompleted);

    return {
      ...profile,
      hasAttempted: hasCompletedAttempt,
      latestAttempt: latestEntry,
      materialSnapshots,
      attemptHistory,
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
      recentAttempts: material.recentAttempts
        .slice()
        .sort((a, b) => {
          const aTs = getTimestamp(a.completedAt) || getTimestamp(a.startedAt) || 0;
          const bTs = getTimestamp(b.completedAt) || getTimestamp(b.startedAt) || 0;
          return bTs - aTs;
        })
        .slice(0, 10),
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
        logger.error('❌ Error fetching class instance:', classError);
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
        logger.error('❌ Error fetching enrollments:', enrollmentError);
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
        logger.error('❌ Error fetching materials:', materialsError);
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
        logger.error('❌ Error fetching quiz sessions:', sessionsError);
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
        logger.error('❌ Error fetching quiz questions:', questionsError);
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
      logger.error('❌ Quiz insights error:', error);
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
