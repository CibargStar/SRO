/**
 * Менеджер мониторинга ресурсов процессов
 * 
 * Управляет мониторингом использования ресурсов Chrome процессов.
 * Отслеживает CPU, память и сетевую активность.
 * 
 * @module modules/profiles/resource-monitoring/process-resources.manager
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../../../config/logger';

const execAsync = promisify(exec);

/**
 * Статистика использования ресурсов процесса
 */
export interface ProcessResourceStats {
  /** ID профиля */
  profileId: string;
  /** PID процесса */
  pid: number;
  /** Использование CPU в процентах (0-100) */
  cpuUsage: number;
  /** Использование памяти в MB */
  memoryUsage: number;
  /** Использование памяти в процентах (0-100) */
  memoryUsagePercent: number;
  /** Время последнего обновления */
  timestamp: Date;
}

/**
 * Менеджер мониторинга ресурсов процессов
 */
export class ProcessResourcesManager {
  private statsCache: Map<string, ProcessResourceStats> = new Map();

  /**
   * Получение статистики ресурсов процесса
   * 
   * @param pid - PID процесса
   * @param profileId - ID профиля
   * @returns Статистика ресурсов или null
   */
  async getProcessStats(pid: number, profileId: string): Promise<ProcessResourceStats | null> {
    try {
      const platform = process.platform;

      if (platform === 'win32') {
        return await this.getWindowsProcessStats(pid, profileId);
      } else if (platform === 'linux' || platform === 'darwin') {
        return await this.getUnixProcessStats(pid, profileId);
      } else {
        logger.warn('Unsupported platform for process monitoring', { platform });
        return null;
      }
    } catch (error) {
      logger.error('Failed to get process stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pid,
        profileId,
      });
      return null;
    }
  }

  /**
   * Получение статистики для Windows
   * 
   * Использует PowerShell вместо устаревшего wmic для совместимости с современными версиями Windows.
   * 
   * @param pid - PID процесса
   * @param profileId - ID профиля
   * @returns Статистика ресурсов
   */
  private async getWindowsProcessStats(
    pid: number,
    profileId: string
  ): Promise<ProcessResourceStats | null> {
    try {
      // Используем PowerShell для получения информации о процессе в Windows
      // Get-Process возвращает объект с WorkingSet (память в байтах) и CPU (время CPU)
      const psCommand = `powershell -Command "Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -Property Id,WorkingSet,CPU | ConvertTo-Json"`;
      
      let processInfo: { Id?: number; WorkingSet?: number; CPU?: number } | null = null;
      
      try {
        const { stdout } = await execAsync(psCommand, { encoding: 'utf8' });
        if (stdout && stdout.trim()) {
          processInfo = JSON.parse(stdout.trim());
        }
      } catch (psError) {
        // Если PowerShell не сработал, пробуем альтернативный метод через Get-CimInstance
        try {
          const cimCommand = `powershell -Command "$proc = Get-CimInstance Win32_Process -Filter \"ProcessId = ${pid}\"; if ($proc) { $proc | Select-Object ProcessId,WorkingSetSize | ConvertTo-Json }"`;
          const { stdout: cimOutput } = await execAsync(cimCommand, { encoding: 'utf8' });
          if (cimOutput && cimOutput.trim()) {
            const cimInfo = JSON.parse(cimOutput.trim());
            processInfo = {
              Id: cimInfo.ProcessId,
              WorkingSet: cimInfo.WorkingSetSize,
              CPU: 0, // Get-CimInstance не предоставляет CPU напрямую
            };
          }
        } catch (cimError) {
          logger.warn('Failed to get process info via PowerShell, trying fallback method', {
            pid,
            profileId,
            psError: psError instanceof Error ? psError.message : 'Unknown error',
            cimError: cimError instanceof Error ? cimError.message : 'Unknown error',
          });
        }
      }

      if (!processInfo || !processInfo.WorkingSet) {
        // Процесс не найден или завершен
        return null;
      }

      const memoryBytes = processInfo.WorkingSet;
      const memoryMB = memoryBytes / (1024 * 1024);

      // Получение общего объема памяти системы для расчета процента
      let totalMemoryMB = 0;
      try {
        const memCommand = `powershell -Command "Get-CimInstance Win32_ComputerSystem | Select-Object -Property TotalPhysicalMemory | ConvertTo-Json"`;
        const { stdout: memOutput } = await execAsync(memCommand, { encoding: 'utf8' });
        if (memOutput && memOutput.trim()) {
          const memInfo = JSON.parse(memOutput.trim());
          const totalMemoryBytes = parseInt(memInfo.TotalPhysicalMemory || '0', 10);
          totalMemoryMB = totalMemoryBytes / (1024 * 1024);
        }
      } catch (memError) {
        logger.warn('Failed to get total system memory', {
          error: memError instanceof Error ? memError.message : 'Unknown error',
        });
        // Используем значение по умолчанию или 0
        totalMemoryMB = 0;
      }

      // CPU usage: получаем процент использования CPU
      // Примечание: точный процент CPU требует сравнения с предыдущим значением или использования счетчиков производительности
      // Для упрощения используем 0, так как это требует дополнительной логики для корректного расчета
      let cpuPercent = 0;
      
      // Попытка получить CPU через счетчики производительности (может не работать для всех процессов)
      try {
        // Используем Get-Counter для получения процента CPU
        // Формат: \Process(имя_процесса#PID)\% Processor Time
        // Пробуем разные варианты имени процесса
        const processNames = ['chrome', 'chrome.exe', 'msedge', 'msedge.exe'];
        for (const procName of processNames) {
          try {
            const cpuCommand = `powershell -Command "$counter = Get-Counter '\\Process(${procName}#${pid})\\% Processor Time' -ErrorAction SilentlyContinue; if ($counter) { $counter.CounterSamples[0].CookedValue } else { $null }"`;
            const { stdout: cpuOutput } = await execAsync(cpuCommand, { encoding: 'utf8', timeout: 5000 });
            if (cpuOutput && cpuOutput.trim() && cpuOutput.trim() !== 'null') {
              const cpuValue = parseFloat(cpuOutput.trim());
              if (!isNaN(cpuValue) && cpuValue >= 0) {
                cpuPercent = cpuValue;
                break; // Успешно получили значение
              }
            }
          } catch {
            // Продолжаем пробовать другие имена процессов
            continue;
          }
        }
      } catch (cpuError) {
        // Если не удалось получить CPU, используем 0
        // Это нормально, так как счетчики производительности могут быть недоступны
        logger.debug('CPU usage not available via performance counters, using 0', {
          pid,
          profileId,
        });
      }

      const memoryUsagePercent = totalMemoryMB > 0 ? (memoryMB / totalMemoryMB) * 100 : 0;

      const stats: ProcessResourceStats = {
        profileId,
        pid,
        cpuUsage: Math.round(cpuPercent * 100) / 100,
        memoryUsage: Math.round(memoryMB * 100) / 100, // Округление до 2 знаков
        memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
        timestamp: new Date(),
      };

      this.statsCache.set(profileId, stats);
      return stats;
    } catch (error) {
      logger.error('Failed to get Windows process stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pid,
        profileId,
      });
      return null;
    }
  }

  /**
   * Получение статистики для Unix-подобных систем (Linux, macOS)
   * 
   * @param pid - PID процесса
   * @param profileId - ID профиля
   * @returns Статистика ресурсов
   */
  private async getUnixProcessStats(
    pid: number,
    profileId: string
  ): Promise<ProcessResourceStats | null> {
    try {
      // Используем ps для получения информации о процессе
      const { stdout } = await execAsync(`ps -p ${pid} -o pid,%cpu,rss --no-headers`);

      if (!stdout.trim()) {
        // Процесс не найден или завершен
        return null;
      }

      const parts = stdout.trim().split(/\s+/);
      if (parts.length < 3) {
        return null;
      }

      const cpuPercent = parseFloat(parts[1] || '0');
      const memoryKB = parseInt(parts[2] || '0', 10);
      const memoryMB = memoryKB / 1024;

      // Получение общего объема памяти системы для расчета процента
      let totalMemoryMB = 0;
      try {
        if (process.platform === 'linux') {
          const { stdout: memInfo } = await execAsync('grep MemTotal /proc/meminfo');
          const memTotalKB = parseInt(memInfo.split(/\s+/)[1] || '0', 10);
          totalMemoryMB = memTotalKB / 1024;
        } else if (process.platform === 'darwin') {
          const { stdout: memInfo } = await execAsync('sysctl hw.memsize');
          const memTotalBytes = parseInt(memInfo.split(':')[1]?.trim() || '0', 10);
          totalMemoryMB = memTotalBytes / (1024 * 1024);
        }
      } catch {
        // Если не удалось получить общий объем памяти, используем 0
        totalMemoryMB = 0;
      }

      const memoryUsagePercent = totalMemoryMB > 0 ? (memoryMB / totalMemoryMB) * 100 : 0;

      const stats: ProcessResourceStats = {
        profileId,
        pid,
        cpuUsage: Math.round(cpuPercent * 100) / 100,
        memoryUsage: Math.round(memoryMB * 100) / 100,
        memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
        timestamp: new Date(),
      };

      this.statsCache.set(profileId, stats);
      return stats;
    } catch (error) {
      logger.error('Failed to get Unix process stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pid,
        profileId,
      });
      return null;
    }
  }

  /**
   * Получение кэшированной статистики
   * 
   * @param profileId - ID профиля
   * @returns Кэшированная статистика или null
   */
  getCachedStats(profileId: string): ProcessResourceStats | null {
    return this.statsCache.get(profileId) || null;
  }

  /**
   * Очистка кэша статистики
   * 
   * @param profileId - ID профиля (опционально, если не указан - очищает весь кэш)
   */
  clearCache(profileId?: string): void {
    if (profileId) {
      this.statsCache.delete(profileId);
    } else {
      this.statsCache.clear();
    }
  }

  /**
   * Получение всех кэшированных статистик
   * 
   * @returns Массив статистик
   */
  getAllCachedStats(): ProcessResourceStats[] {
    return Array.from(this.statsCache.values());
  }
}

