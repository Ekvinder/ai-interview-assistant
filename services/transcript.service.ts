import { Transcript } from '../models/Transcript';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../utils/constants';
import { connectToDatabase } from '../lib/mongodb';

export class TranscriptService {
  static async appendTranscript(interviewId: string, data: { speaker: 'AI' | 'USER'; text: string; timestamp: number }) {
    await connectToDatabase();
    const transcript = new Transcript({
      interviewId,
      ...data,
    });
    await transcript.save();
    return transcript;
  }

  static async getTranscript(interviewId: string) {
    await connectToDatabase();
    const transcripts = await Transcript.find({ interviewId }).sort({ timestamp: 1 });
    return transcripts;
  }
}
