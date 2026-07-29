import { Evaluation } from '../models/Evaluation';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../utils/constants';
import { connectToDatabase } from '../lib/mongodb';

export class EvaluationService {
  static async createEvaluation(interviewId: string, data: any) {
    await connectToDatabase();
    // Check if evaluation already exists
    let evaluation = await Evaluation.findOne({ interviewId });
    if (evaluation) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Evaluation already exists for this interview');
    }

    evaluation = new Evaluation({
      interviewId,
      ...data,
    });
    await evaluation.save();
    return evaluation;
  }

  static async getEvaluation(interviewId: string) {
    await connectToDatabase();
    const evaluation = await Evaluation.findOne({ interviewId });
    if (!evaluation) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Evaluation not found');
    }
    return evaluation;
  }
}
