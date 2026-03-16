import type { Document, Types } from 'mongoose';

export type ProjectStatus = 'draft' | 'active' | 'archived';

export interface IProjectSettings {
  outputResolution: string;
  outputFormat: string;
  frameRate: number;
}

export interface IProject {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  description?: string;
  settings: IProjectSettings;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProjectDocument extends Omit<IProject, '_id'>, Document {}

export interface CreateProjectDto {
  name: string;
  description?: string;
  settings?: Partial<IProjectSettings>;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  settings?: Partial<IProjectSettings>;
  status?: ProjectStatus;
}

export interface ListProjectsQuery {
  status?: ProjectStatus;
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
