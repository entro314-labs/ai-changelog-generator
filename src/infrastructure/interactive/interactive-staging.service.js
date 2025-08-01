import { execSync } from 'child_process';
import colors from '../../shared/constants/colors.js';

/**
 * Interactive Staging Service
 * 
 * Provides interactive git staging functionality similar to better-commits
 * Handles file selection, staging, and unstaging operations
 */
export class InteractiveStagingService {
  constructor(gitManager) {
    this.gitManager = gitManager;
  }

  /**
   * Show git status with staged and unstaged changes
   */
  async showGitStatus() {
    console.log(colors.processingMessage(' Checking Git Status '));

    const statusResult = this.getDetailedStatus();
    
    if (statusResult.staged.length > 0) {
      console.log(colors.successMessage('Changes to be committed:'));
      statusResult.staged.forEach(file => {
        const icon = this.getStatusIcon(file.status);
        console.log(colors.success(`  ${icon} ${file.status} ${file.path}`));
      });
    }

    if (statusResult.unstaged.length > 0) {
      console.log(colors.warningMessage('\nChanges not staged for commit:'));
      statusResult.unstaged.forEach(file => {
        const icon = this.getStatusIcon(file.status);
        console.log(colors.warning(`  ${icon} ${file.status} ${file.path}`));
      });
    }

    if (statusResult.untracked.length > 0) {
      console.log(colors.infoMessage('\nUntracked files:'));
      statusResult.untracked.forEach(file => {
        console.log(colors.dim(`  ✨ ?? ${file.path}`));
      });
    }

    return statusResult;
  }

  /**
   * Interactive file selection for staging
   */
  async selectFilesToStage(files = null) {
    const { multiselect, confirm } = await import('@clack/prompts');

    // Get current status if files not provided
    if (!files) {
      const status = this.getDetailedStatus();
      files = [...status.unstaged, ...status.untracked];
    }

    if (files.length === 0) {
      console.log(colors.infoMessage('No files available for staging.'));
      return [];
    }

    // Create choices for the multiselect prompt
    const choices = files.map(file => ({
      value: file.path,
      label: `${this.getStatusIcon(file.status)} ${file.status} ${file.path}`,
      hint: this.getStatusDescription(file.status)
    }));

    try {
      const selectedFiles = await multiselect({
        message: 'Select files to stage for commit:',
        options: choices,
        required: false
      });

      if (!selectedFiles || selectedFiles.length === 0) {
        console.log(colors.infoMessage('No files selected for staging.'));
        return [];
      }

      // Confirm the selection
      const shouldStage = await confirm({
        message: `Stage ${selectedFiles.length} file(s)?`,
        initialValue: true
      });

      if (shouldStage) {
        await this.stageFiles(selectedFiles);
        console.log(colors.successMessage(`✅ Staged ${selectedFiles.length} file(s)`));
        return selectedFiles;
      } else {
        console.log(colors.infoMessage('Staging cancelled.'));
        return [];
      }
    } catch (error) {
      if (error.message.includes('cancelled')) {
        console.log(colors.infoMessage('File selection cancelled.'));
      } else {
        console.error(colors.errorMessage(`Error during file selection: ${error.message}`));
      }
      return [];
    }
  }

  /**
   * Interactive unstaging of files
   */
  async selectFilesToUnstage() {
    const { multiselect, confirm } = await import('@clack/prompts');

    const status = this.getDetailedStatus();
    const stagedFiles = status.staged;

    if (stagedFiles.length === 0) {
      console.log(colors.infoMessage('No staged files to unstage.'));
      return [];
    }

    const choices = stagedFiles.map(file => ({
      value: file.path,
      label: `${this.getStatusIcon(file.status)} ${file.status} ${file.path}`,
      hint: 'Remove from staging area'
    }));

    try {
      const selectedFiles = await multiselect({
        message: 'Select files to unstage:',
        options: choices,
        required: false
      });

      if (!selectedFiles || selectedFiles.length === 0) {
        console.log(colors.infoMessage('No files selected for unstaging.'));
        return [];
      }

      const shouldUnstage = await confirm({
        message: `Unstage ${selectedFiles.length} file(s)?`,
        initialValue: true
      });

      if (shouldUnstage) {
        await this.unstageFiles(selectedFiles);
        console.log(colors.successMessage(`✅ Unstaged ${selectedFiles.length} file(s)`));
        return selectedFiles;
      } else {
        console.log(colors.infoMessage('Unstaging cancelled.'));
        return [];
      }
    } catch (error) {
      if (error.message.includes('cancelled')) {
        console.log(colors.infoMessage('File unstaging cancelled.'));
      } else {
        console.error(colors.errorMessage(`Error during file unstaging: ${error.message}`));
      }
      return [];
    }
  }

  /**
   * Stage all changes
   */
  async stageAllChanges() {
    try {
      console.log(colors.processingMessage('Staging all changes...'));
      execSync('git add .', { stdio: 'pipe' });
      console.log(colors.successMessage('✅ All changes staged'));
      return true;
    } catch (error) {
      console.error(colors.errorMessage(`Error staging all changes: ${error.message}`));
      return false;
    }
  }

  /**
   * Stage specific files
   */
  async stageFiles(filePaths) {
    try {
      const files = Array.isArray(filePaths) ? filePaths : [filePaths];
      
      for (const file of files) {
        execSync(`git add "${file}"`, { stdio: 'pipe' });
      }
      
      return true;
    } catch (error) {
      console.error(colors.errorMessage(`Error staging files: ${error.message}`));
      return false;
    }
  }

  /**
   * Unstage specific files
   */
  async unstageFiles(filePaths) {
    try {
      const files = Array.isArray(filePaths) ? filePaths : [filePaths];
      
      for (const file of files) {
        execSync(`git reset HEAD "${file}"`, { stdio: 'pipe' });
      }
      
      return true;
    } catch (error) {
      console.error(colors.errorMessage(`Error unstaging files: ${error.message}`));
      return false;
    }
  }

  /**
   * Get detailed git status (staged, unstaged, untracked)
   */
  getDetailedStatus() {
    try {
      const output = execSync('git status --porcelain', { encoding: 'utf8' });
      const lines = output.split('\n').filter(Boolean);

      const staged = [];
      const unstaged = [];
      const untracked = [];

      lines.forEach(line => {
        if (line.length < 3) return;

        const indexStatus = line.charAt(0);
        const workTreeStatus = line.charAt(1);
        const filePath = line.substring(3).trim();

        // Handle different status combinations
        if (indexStatus === '?' && workTreeStatus === '?') {
          // Untracked file
          untracked.push({ status: '??', path: filePath });
        } else {
          // Staged changes (index status)
          if (indexStatus !== ' ') {
            staged.push({ status: indexStatus, path: filePath });
          }
          
          // Unstaged changes (work tree status)
          if (workTreeStatus !== ' ') {
            unstaged.push({ status: workTreeStatus, path: filePath });
          }
        }
      });

      return { staged, unstaged, untracked };
    } catch (error) {
      console.error(colors.errorMessage(`Error getting git status: ${error.message}`));
      return { staged: [], unstaged: [], untracked: [] };
    }
  }

  /**
   * Get icon for status
   */
  getStatusIcon(status) {
    const icons = {
      'M': '📝', // Modified
      'A': '✨', // Added
      'D': '🗑️', // Deleted
      'R': '🔄', // Renamed
      'C': '📋', // Copied
      'U': '⚠️', // Unmerged
      '??': '✨' // Untracked
    };
    return icons[status] || '📄';
  }

  /**
   * Get description for status
   */
  getStatusDescription(status) {
    const descriptions = {
      'M': 'Modified file',
      'A': 'New file',
      'D': 'Deleted file', 
      'R': 'Renamed file',
      'C': 'Copied file',
      'U': 'Unmerged file',
      '??': 'Untracked file'
    };
    return descriptions[status] || 'Changed file';
  }

  /**
   * Check if there are any staged changes
   */
  hasStagedChanges() {
    try {
      const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
      return output.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if there are any unstaged changes
   */
  hasUnstagedChanges() {
    try {
      const output = execSync('git diff --name-only', { encoding: 'utf8' });
      return output.trim().length > 0;
    } catch (error) {
      return false;
    }
  }
}