import { User } from '../models/User';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../utils/constants';
import { connectToDatabase } from '../lib/mongodb';

export class UserService {
  static async getUserById(userId: string) {
    await connectToDatabase();
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }
    return user;
  }

  static async updateUser(userId: string, data: { name?: string; image?: string }) {
    await connectToDatabase();
    const user = await User.findByIdAndUpdate(userId, data, { new: true });
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }
    return user;
  }

  static async deleteUser(userId: string) {
    await connectToDatabase();
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }
    return true;
  }
}