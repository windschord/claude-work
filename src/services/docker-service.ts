import Docker from 'dockerode';
import { logger } from '@/lib/logger';

export interface ContainerOptions {
  image: string;
  name: string;
  env: Record<string, string>;
  volumes: VolumeMount[];
  mounts: BindMount[];
}

export interface VolumeMount {
  source: string;  // Volume name
  target: string;  // Container path
}

export interface BindMount {
  source: string;  // Host path
  target: string;  // Container path
  readOnly: boolean;
}

export interface ContainerStatus {
  status: string;
  running: boolean;
}

export interface VolumeInfo {
  name: string;
}

export class DockerService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  async isDockerRunning(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      logger.warn('Docker is not running or not accessible', { error });
      return false;
    }
  }

  async createContainer(options: ContainerOptions): Promise<Docker.Container> {
    const envArray = Object.entries(options.env).map(
      ([key, value]) => `${key}=${value}`
    );

    const binds: string[] = [];
    const volumeBindings: Record<string, Record<string, never>> = {};

    // Add volume mounts
    for (const vol of options.volumes) {
      binds.push(`${vol.source}:${vol.target}`);
      volumeBindings[vol.target] = {};
    }

    // Add bind mounts
    for (const mount of options.mounts) {
      const bindString = mount.readOnly
        ? `${mount.source}:${mount.target}:ro`
        : `${mount.source}:${mount.target}`;
      binds.push(bindString);
    }

    const createOptions: Docker.ContainerCreateOptions = {
      Image: options.image,
      name: options.name,
      Env: envArray,
      Volumes: volumeBindings,
      HostConfig: {
        Binds: binds,
      },
      Tty: true,
      OpenStdin: true,
    };

    logger.info('Creating container', { name: options.name, image: options.image });
    const container = await this.docker.createContainer(createOptions);
    return container;
  }

  async startContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.start();
    logger.info('Container started', { containerId });
  }

  async stopContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.stop();
    logger.info('Container stopped', { containerId });
  }

  async removeContainer(containerId: string, force: boolean = false): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.remove({ force });
    logger.info('Container removed', { containerId, force });
  }

  async createVolume(name: string): Promise<VolumeInfo> {
    const volume = await this.docker.createVolume({ Name: name });
    logger.info('Volume created', { name });
    return { name: volume.name };
  }

  async removeVolume(name: string): Promise<void> {
    const volume = this.docker.getVolume(name);
    await volume.remove();
    logger.info('Volume removed', { name });
  }

  async getContainerStatus(containerId: string): Promise<ContainerStatus> {
    const container = this.docker.getContainer(containerId);
    const info = await container.inspect();
    return {
      status: info.State.Status,
      running: info.State.Running,
    };
  }

  async execCommand(containerId: string, command: string[]): Promise<{ exitCode: number; output: string }> {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    return new Promise((resolve, reject) => {
      let output = '';

      stream.on('data', (chunk: Buffer) => {
        // Docker multiplexes stdout/stderr, skip the 8-byte header
        const data = chunk.slice(8).toString('utf8');
        output += data;
      });

      stream.on('end', async () => {
        try {
          const inspectResult = await exec.inspect();
          resolve({
            exitCode: inspectResult.ExitCode ?? 0,
            output: output.trim(),
          });
        } catch (error) {
          reject(error);
        }
      });

      stream.on('error', reject);
    });
  }

  getDocker(): Docker {
    return this.docker;
  }
}
