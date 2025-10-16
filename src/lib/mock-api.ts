// Mock API service for testing without Supabase
export class MockAPIService {
  private static baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  static async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Mock courses
  static async getCourses() {
    return this.request('/api/courses');
  }

  static async createCourse(courseData: any) {
    return this.request('/api/courses', {
      method: 'POST',
      body: JSON.stringify(courseData),
    });
  }

  // Mock sessions
  static async getSessions(courseId: string) {
    return this.request(`/api/sessions/${courseId}`);
  }

  static async createSession(sessionData: any) {
    return this.request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  // Mock QR codes
  static async generateQRCode(sessionId: string) {
    return this.request(`/api/sessions/${sessionId}/qr`);
  }

  // Mock attendance
  static async scanQRCode(sessionId: string, qrData: string) {
    return this.request(`/api/sessions/${sessionId}/scan`, {
      method: 'POST',
      body: JSON.stringify({ qrData }),
    });
  }

  static async getAttendance(sessionId: string) {
    return this.request(`/api/sessions/${sessionId}/attendance`);
  }

  // Mock analytics
  static async getAnalytics(courseId: string) {
    return this.request(`/api/courses/${courseId}/analytics`);
  }
}
