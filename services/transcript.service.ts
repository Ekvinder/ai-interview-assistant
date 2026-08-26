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
  static async appendMeetingTranscript(meetingId: string, speakerId: string, speakerName: string, message: string, timestamp: number) {
    await connectToDatabase();
    const transcript = new Transcript({
      meetingId,
      speaker: speakerId,
      speakerName,
      message,
      timestamp,
    });
    await transcript.save();
    return transcript;
  }

  static async getMeetingTranscript(meetingId: string) {
    await connectToDatabase();
    const transcripts = await Transcript.find({ meetingId }).sort({ timestamp: 1 });
    return transcripts;
  }
}
