import { User } from "./user.schema";

class UserService {
  // Save user to db
  async saveUser(userId: string) {
    const user = await User.findOne({ userId });
    if (user) return;
    const newUser = new User({ userId });
    await newUser.save();
  }

  async pauseUser(userId: string) {
    const user = await User.findOne({ userId });
    if (!user) return;
    user.isPaused = true;
    await user.save();
  }

  async unpauseUser(userId: string) {
    const user = await User.findOne({ userId });
    if (!user) return;
    user.isPaused = false;
    await user.save();
  }

  async setPollInterval(userId: string, interval: number) {
    const user = await User.findOne({ userId });
    if (!user) return;
    user.pollInterval = interval;
    await user.save();
  }

  async getUser(userId: string) {
    const user = await User.findOne({ userId });
    return user;
  }

  async getAllUsers() {
    const users = await User.find();
    return users;
  }
}

export const userService = new UserService();
