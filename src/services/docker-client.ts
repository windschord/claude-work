import Docker from 'dockerode';
import { logger } from '@/lib/logger';

export class DockerClient {
  private static instance: DockerClient;
  private docker: Docker;

  private constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  public static getInstance(): DockerClient {
    if (!DockerClient.instance) {
      DockerClient.instance = new DockerClient();
    }
    return DockerClient.instance;
  }

  public static resetForTesting(): void {
    DockerClient.instance = undefined as any;
  }

  public getDockerInstance(): Docker {
    return this.docker;
  }

  public async ping(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      logger.error('Failed to ping Docker daemon', { error });
      return false;
    }
  }

  public async info(): Promise<Record<string, unknown>> {
    try {
      return await this.docker.info();
    } catch (error) {
      logger.error('Failed to get Docker info', { error });
      throw error;
    }
  }

  public async inspectImage(name: string): Promise<Docker.ImageInspectInfo> {
    try {
      const image = this.docker.getImage(name);
      return await image.inspect();
    } catch (error) {
      // Don't log error here as it might be expected (e.g. image not found)
      throw error;
    }
  }

  public getImage(name: string): Docker.Image {
    return this.docker.getImage(name);
  }

  public async listImages(options?: Docker.ListImagesOptions): Promise<Docker.ImageInfo[]> {
    try {
      return await this.docker.listImages(options);
    } catch (error) {
      logger.error('Failed to list images', { error });
      throw error;
    }
  }

  public async inspectContainer(id: string): Promise<Docker.ContainerInspectInfo> {
    try {
      const container = this.docker.getContainer(id);
      return await container.inspect();
    } catch (error) {
      // Don't log error here as it might be expected
      throw error;
    }
  }
  
  public getContainer(id: string): Docker.Container {
    return this.docker.getContainer(id);
  }

  public async listContainers(options?: Docker.ContainerListOptions): Promise<Docker.ContainerInfo[]> {
    try {
      return await this.docker.listContainers(options);
    } catch (error) {
      logger.error('Failed to list containers', { error });
      throw error;
    }
  }

  public async createContainer(options: Docker.ContainerCreateOptions): Promise<Docker.Container> {
    try {
      return await this.docker.createContainer(options);
    } catch (error) {
      logger.error('Failed to create container', { error });
      throw error;
    }
  }

  public async createVolume(name: string): Promise<Docker.VolumeCreateResponse> {
    try {
      return await this.docker.createVolume({ Name: name });
    } catch (error) {
      logger.error(`Failed to create volume: ${name}`, { error });
      throw error;
    }
  }

  public getVolume(name: string): Docker.Volume {
    return this.docker.getVolume(name);
  }

  public async removeVolume(name: string): Promise<void> {
    try {
      const volume = this.docker.getVolume(name);
      await volume.remove();
    } catch (error) {
      logger.error(`Failed to remove volume: ${name}`, { error });
      throw error;
    }
  }

  public async buildImage(
    stream: NodeJS.ReadableStream,
    options: Docker.ImageBuildOptions,
    onProgress?: (event: any) => void
  ): Promise<void> {
    try {
      const buildStream = await this.docker.buildImage(stream, options);
      
      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(
          buildStream,
          (err: Error | null, res: any[]) => {
            if (err) return reject(err);
            resolve();
          },
          (event: any) => {
            if (onProgress) {
              onProgress(event);
            }
          }
        );
      });
    } catch (error) {
      logger.error('Failed to build image', { error });
      throw error;
    }
  }

  public async pull(repoTag: string, onProgress?: (event: any) => void): Promise<void> {
    try {
      const stream = await this.docker.pull(repoTag);
      
      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(
          stream,
          (err: Error | null, res: any[]) => {
            if (err) return reject(err);
            resolve();
          },
          (event: any) => {
            if (onProgress) {
              onProgress(event);
            }
          }
        );
      });
    } catch (error) {
      logger.error(`Failed to pull image: ${repoTag}`, { error });
      throw error;
    }
  }

  // Wrapper for running a command in a new container (like docker run)
  public async run(
    image: string,
    cmd: string[],
    stream: NodeJS.WritableStream | NodeJS.WritableStream[],
    options: Docker.ContainerCreateOptions = {}
  ): Promise<{ StatusCode: number }> {
    return new Promise((resolve, reject) => {
      (this.docker.run as Function)(image, cmd, stream, options, (err: Error | null, data: { StatusCode: number }) => {
        if (err) return reject(err);
        resolve(data);
      });
    });
  }
}
