import { NotFoundError, ValidationError } from '../../common/errors/index.js';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../../common/utils/encryption.js';
import type { UserRepository } from './user.repository.js';
import type { IUserDocument, IUserPublic, IUserDefaultProviders, UpdateUserDto } from './user.types.js';

export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly encryptionSecret?: string,
  ) {}

  async getProfile(userId: string): Promise<IUserDocument> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: UpdateUserDto,
  ): Promise<IUserDocument> {
    const user = await this.userRepository.updateById(userId, data);

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  toPublicUser(user: IUserDocument): IUserPublic {
    return {
      _id: user._id as IUserPublic['_id'],
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      defaultProviders: user.defaultProviders,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // ── API Key Management ──

  async setProviderApiKey(
    userId: string,
    provider: string,
    apiKey: string,
  ): Promise<void> {
    if (!this.encryptionSecret) {
      throw new ValidationError('API key encryption is not configured');
    }

    const encrypted = encryptApiKey(apiKey, this.encryptionSecret);
    await this.userRepository.setProviderApiKey(userId, provider, encrypted);
  }

  async getProviderApiKeys(
    userId: string,
  ): Promise<{ provider: string; maskedKey: string }[]> {
    if (!this.encryptionSecret) {
      return [];
    }

    const keysMap = await this.userRepository.getProviderApiKeys(userId);
    const result: { provider: string; maskedKey: string }[] = [];

    for (const [provider, encrypted] of keysMap.entries()) {
      try {
        const decrypted = decryptApiKey(encrypted, this.encryptionSecret);
        result.push({ provider, maskedKey: maskApiKey(decrypted) });
      } catch {
        result.push({ provider, maskedKey: '****' });
      }
    }

    return result;
  }

  async removeProviderApiKey(
    userId: string,
    provider: string,
  ): Promise<void> {
    await this.userRepository.removeProviderApiKey(userId, provider);
  }

  async getDecryptedApiKey(
    userId: string,
    provider: string,
  ): Promise<string | null> {
    if (!this.encryptionSecret) {
      return null;
    }

    const keysMap = await this.userRepository.getProviderApiKeys(userId);
    const encrypted = keysMap.get(provider);

    if (!encrypted) {
      return null;
    }

    return decryptApiKey(encrypted, this.encryptionSecret);
  }

  async updateDefaultProviders(
    userId: string,
    providers: IUserDefaultProviders,
  ): Promise<IUserDocument> {
    const user = await this.userRepository.updateDefaultProviders(userId, providers);

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }
}
