import { User } from "./user.schema";

class UserService {
  async saveUser(chatId: string) {
    const user = await User.findOne({ chatId });
    if (user) return;
    const newUser = new User({ chatId });
    await newUser.save();
  }

  async pauseUser(chatId: string) {
    const user = await User.findOne({ chatId });
    if (!user) return;
    user.isPaused = true;
    await user.save();
  }

  async unpauseUser(chatId: string) {
    const user = await User.findOne({ chatId });
    if (!user) return;
    user.isPaused = false;
    await user.save();
  }

  async setPollInterval(chatId: string, interval: number) {
    const user = await User.findOne({ chatId });
    if (!user) return;
    user.pollInterval = interval;
    await user.save();
  }

  async getPollInterval(chatId: string) {
    const user = await User.findOne({ chatId });
    if (!user) return;
    return user.pollInterval;
  }

  async getUser(chatId: string) {
    const user = await User.findOne({ chatId });
    return user;
  }

  async getActiveUsers() {
    return await User.find({ isPaused: false });
  }

  async getAllUsers() {
    const users = await User.find();
    return users;
  }
}

export const userService = new UserService();
