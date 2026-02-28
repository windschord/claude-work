import Docker from 'dockerode';
import { logger } from '@/lib/logger';

export class DockerClient {
  private static instance: DockerClient | undefined;
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
    DockerClient.instance = undefined;
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

  public async listVolumes(): Promise<Docker.VolumeListResponse> {
    try {
      return await this.docker.listVolumes();
    } catch (error) {
      logger.error('Failed to list volumes', { error });
      throw error;
    }
  }

  public async inspectVolume(name: string): Promise<Docker.VolumeInspectInfo> {
    try {
      const volume = this.docker.getVolume(name);
      return await volume.inspect();
    } catch (error) {
      logger.error(`Failed to inspect volume: ${name}`, { error });
      throw error;
    }
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
          (err: Error | null, _res: any[]) => {
            if (err) return reject(err);
            resolve();
          },
          (event: any) => {
            if (onProgress) {
              try {
                onProgress(event);
              } catch (callbackError) {
                logger.error('onProgress callback threw an exception', { callbackError });
              }
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
          (err: Error | null, _res: any[]) => {
            if (err) return reject(err);
            resolve();
          },
          (event: any) => {
            if (onProgress) {
              try {
                onProgress(event);
              } catch (callbackError) {
                logger.error('onProgress callback threw an exception', { callbackError });
              }
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
  // Dockerode's docker.run() returns [data, container] array where data has StatusCode.
  public async run(
    image: string,
    cmd: string[],
    stream: NodeJS.WritableStream | NodeJS.WritableStream[],
    options: Docker.ContainerCreateOptions = {}
  ): Promise<{ StatusCode: number }> {
    const result = await this.docker.run(image, cmd, stream, options);

    // docker.run() returns [{ StatusCode: number }, Container] array.
    // Extract the status data from the first element.
    const data = Array.isArray(result) ? result[0] : result;

    if (
      data == null ||
      typeof data !== 'object' ||
      typeof (data as Record<string, unknown>).StatusCode !== 'number'
    ) {
      const resultStr = (() => { try { return JSON.stringify(result); } catch { return String(result); } })();
      throw new Error(
        `Unexpected docker.run() result: expected object with numeric StatusCode, got ${resultStr}`
      );
    }

    return data as { StatusCode: number };
  }
}
