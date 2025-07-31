import { handleUnifiedOutput, outputData } from '../../shared/utils/utils.js';
import colors from '../../shared/constants/colors.js';

/**
 * Git Repository Analyzer
 *
 * Repository analysis and branch management functionality
 * Provides comprehensive git repository analysis including:
 * - Branch analysis and comparison
 * - Untracked files detection and categorization
 * - Repository health assessment
 * - Code quality and structure analysis
 */
export class GitRepositoryAnalyzer {
  constructor(gitManager, aiAnalysisService) {
    this.gitManager = gitManager;
    this.aiAnalysisService = aiAnalysisService;
  }

  async analyzeBranches(format = 'markdown') {
    if (!this.gitManager.isGitRepo) {
      const errorMsg = 'Not a git repository';
      if (format === 'json') {
        outputData({ error: errorMsg }, format);
        return;
      }
      console.log(colors.errorMessage(errorMsg));
      return;
    }

    if (format === 'markdown') {
      console.log(colors.processingMessage('Analyzing git branches and unmerged commits...'));
    }

    try {
      const branches = this.gitManager.getAllBranches();
      const unmergedCommits = this.gitManager.getUnmergedCommits();
      const danglingCommits = this.gitManager.getDanglingCommits();

      let aiAnalysis = null;
      if (this.aiAnalysisService.hasAI && (unmergedCommits.length > 0 || danglingCommits.length > 0)) {
        aiAnalysis = await this.aiAnalysisService.getBranchesAIAnalysis(branches, unmergedCommits, danglingCommits);
      }

      const data = {
        type: 'branch_analysis',
        timestamp: new Date().toISOString(),
        branches: {
          local: branches.local.map(branch => ({
            name: branch,
            current: branch === branches.current
          })),
          remote: branches.remote,
          current: branches.current,
          summary: {
            localCount: branches.local.length,
            remoteCount: branches.remote.length
          }
        },
        unmergedCommits: unmergedCommits.map(branch => ({
          branch: branch.branch,
          commitCount: branch.commits.length,
          commits: branch.commits.map(commit => ({
            hash: commit.hash,
            shortHash: commit.shortHash,
            subject: commit.subject,
            author: commit.author,
            date: commit.date
          }))
        })),
        danglingCommits: danglingCommits.map(commit => ({
          hash: commit.hash,
          shortHash: commit.shortHash,
          subject: commit.subject,
          author: commit.author,
          date: commit.date
        })),
        summary: {
          totalBranches: branches.local.length + branches.remote.length,
          unmergedCommitCount: unmergedCommits.reduce((sum, branch) => sum + branch.commits.length, 0),
          danglingCommitCount: danglingCommits.length,
          hasUnmergedWork: unmergedCommits.length > 0,
          hasDanglingCommits: danglingCommits.length > 0
        },
        aiAnalysis
      };

      if (format === 'json') {
        outputData(data, format);
        return data;
      }

      // Markdown format display
      console.log(colors.header('\n📊 Branch Analysis:'));
      console.log(colors.subheader(`🌿 Local branches (${colors.number(branches.local.length)}):`));
      branches.local.forEach(branch => {
        const indicator = branch === branches.current ? '* ' : '  ';
        const branchColor = branch === branches.current ? colors.highlight : colors.secondary;
        console.log(`${indicator}${branchColor(branch)}`);
      });

      if (branches.remote.length > 0) {
        console.log(colors.subheader(`\n🌐 Remote branches (${colors.number(branches.remote.length)}):`));
        branches.remote.slice(0, 10).forEach(branch => console.log(`  - ${colors.secondary(branch)}`));
        if (branches.remote.length > 10) {
          console.log(colors.dim(`  ... and ${branches.remote.length - 10} more`));
        }
      }

      if (unmergedCommits.length > 0) {
        console.log(colors.subheader(`\n🔄 Unmerged commits in other branches:`));
        unmergedCommits.forEach(branch => {
          console.log(`\n  ${colors.label(branch.branch)} (${colors.number(branch.commits.length)} commits):`);
          branch.commits.slice(0, 3).forEach(commit => {
            console.log(`    - ${colors.hash(commit.shortHash)}: ${colors.value(commit.subject)} (${colors.secondary(commit.author)})`);
          });
          if (branch.commits.length > 3) {
            console.log(colors.dim(`    ... and ${branch.commits.length - 3} more commits`));
          }
        });
      } else {
        console.log(colors.successMessage('\n✅ No unmerged commits found'));
      }

      if (danglingCommits.length > 0) {
        console.log(colors.warningMessage(`\n🗑️  Dangling commits (${colors.number(danglingCommits.length)}):`));
        danglingCommits.slice(0, 5).forEach(commit => {
          console.log(`  - ${colors.hash(commit.shortHash)}: ${colors.value(commit.subject)} (${colors.secondary(commit.author)})`);
        });
        if (danglingCommits.length > 5) {
          console.log(colors.dim(`  ... and ${danglingCommits.length - 5} more`));
        }
        console.log(colors.infoMessage('\n💡 These commits are unreachable from any branch. Consider creating a branch or removing them.'));
      }

      if (aiAnalysis) {
        console.log(colors.aiMessage('\n🤖 AI Analysis of branch situation:'));
        console.log(aiAnalysis);
      }

      return data;

    } catch (error) {
      if (format === 'json') {
        outputData({ error: `Error analyzing branches: ${error.message}` }, format);
        return { error: error.message };
      }
      console.error(colors.errorMessage(`Error analyzing branches: ${error.message}`));
      throw error;
    }
  }

  async analyzeComprehensive(format = 'markdown') {
    if (!this.gitManager.isGitRepo) {
      const errorMsg = 'Not a git repository';
      if (format === 'json') {
        outputData({ error: errorMsg }, format);
        return;
      }
      console.log(colors.errorMessage(errorMsg));
      return;
    }

    if (format === 'markdown') {
      console.log(colors.processingMessage('Comprehensive repository analysis...'));
    }

    try {
      const comprehensiveData = this.gitManager.getComprehensiveAnalysis();

      if (!comprehensiveData) {
        const errorMsg = 'Failed to get comprehensive analysis';
        if (format === 'json') {
          outputData({ error: errorMsg }, format);
          return;
        }
        console.log(colors.errorMessage(errorMsg));
        return;
      }

      // Get untracked files
      const untrackedFiles = this.gitManager.getUntrackedFiles();
      const untrackedCategories = this.categorizeUntrackedFiles(untrackedFiles);

      let aiAnalysis = null;
      if (this.aiAnalysisService.hasAI) {
        aiAnalysis = await this.aiAnalysisService.getRepositoryAIAnalysis(comprehensiveData);
      }

      const data = {
        type: 'comprehensive_analysis',
        timestamp: new Date().toISOString(),
        repository: comprehensiveData,
        untrackedFiles: {
          files: untrackedFiles,
          categories: untrackedCategories,
          summary: {
            totalFiles: untrackedFiles.length,
            categoryCounts: Object.keys(untrackedCategories).reduce((acc, key) => {
              acc[key] = untrackedCategories[key].length;
              return acc;
            }, {})
          }
        },
        aiAnalysis
      };

      if (format === 'json') {
        outputData(data, format);
        return data;
      }

      // Display comprehensive analysis
      console.log(colors.header('\n📊 Comprehensive Repository Analysis:'));

      // Repository statistics
      console.log(colors.subheader('\n📈 Repository Statistics:'));
      console.log(`   ${colors.label('Total commits')}: ${colors.number(comprehensiveData.totalCommits || 0)}`);
      console.log(`   ${colors.label('Contributors')}: ${colors.number(comprehensiveData.contributors?.length || 0)}`);
      console.log(`   ${colors.label('Files tracked')}: ${colors.number(comprehensiveData.totalFiles || 0)}`);
      console.log(`   ${colors.label('Branches')}: ${colors.number(comprehensiveData.branchCount || 0)}`);

      // Recent activity
      if (comprehensiveData.recentActivity) {
        console.log(colors.subheader('\n🔥 Recent Activity:'));
        console.log(`   ${colors.label('Commits this week')}: ${colors.number(comprehensiveData.recentActivity.thisWeek || 0)}`);
        console.log(`   ${colors.label('Commits this month')}: ${colors.number(comprehensiveData.recentActivity.thisMonth || 0)}`);
      }

      // File type breakdown
      if (comprehensiveData.fileTypes) {
        console.log(colors.subheader('\n📁 File Type Breakdown:'));
        Object.entries(comprehensiveData.fileTypes).forEach(([type, count]) => {
          console.log(`   ${colors.label(type)}: ${colors.number(count)}`);
        });
      }

      // Untracked files summary
      if (untrackedFiles.length > 0) {
        console.log(colors.subheader(`\n📄 Untracked Files (${colors.number(untrackedFiles.length)}):`));
        Object.entries(untrackedCategories).forEach(([category, files]) => {
          if (files.length > 0) {
            console.log(`   ${colors.label(category)}: ${colors.number(files.length)} files`);
          }
        });
      }

      if (aiAnalysis) {
        console.log(colors.aiMessage('\n🤖 AI Repository Analysis:'));
        console.log(aiAnalysis);
      }

      return data;

    } catch (error) {
      if (format === 'json') {
        outputData({ error: `Error in comprehensive analysis: ${error.message}` }, format);
        return { error: error.message };
      }
      console.error(colors.errorMessage(`Error in comprehensive analysis: ${error.message}`));
      throw error;
    }
  }

  async analyzeUntrackedFiles(format = 'markdown') {
    if (!this.gitManager.isGitRepo) {
      const errorMsg = 'Not a git repository';
      if (format === 'json') {
        outputData({ error: errorMsg }, format);
        return;
      }
      console.log(colors.errorMessage(errorMsg));
      return;
    }

    if (format === 'markdown') {
      console.log(colors.processingMessage('Analyzing untracked files...'));
    }

    try {
      const untrackedFiles = this.gitManager.getUntrackedFiles();

      if (untrackedFiles.length === 0) {
        const message = 'No untracked files found';
        if (format === 'json') {
          outputData({ message, files: [] }, format);
          return { message, files: [] };
        }
        console.log(colors.successMessage('✅ No untracked files found'));
        return;
      }

      const categories = this.categorizeUntrackedFiles(untrackedFiles);
      const recommendations = this.generateUntrackedRecommendations(categories);

      let aiAnalysis = null;
      if (this.aiAnalysisService.hasAI && untrackedFiles.length > 0) {
        aiAnalysis = await this.aiAnalysisService.getUntrackedFilesAIAnalysis(categories);
      }

      const data = {
        type: 'untracked_files_analysis',
        timestamp: new Date().toISOString(),
        files: untrackedFiles,
        categories: Object.keys(categories).reduce((acc, key) => {
          acc[key] = {
            count: categories[key].length,
            files: categories[key]
          };
          return acc;
        }, {}),
        summary: {
          totalFiles: untrackedFiles.length,
          categoryCounts: Object.keys(categories).reduce((acc, key) => {
            acc[key] = categories[key].length;
            return acc;
          }, {})
        },
        recommendations,
        aiAnalysis
      };

      if (format === 'json') {
        outputData(data, format);
        return data;
      }

      // Markdown format display
      console.log(colors.header('\n📄 Untracked Files Analysis:'));

      Object.entries(categories).forEach(([category, files]) => {
        if (files.length > 0) {
          console.log(colors.subheader(`\n📁 ${category} (${colors.number(files.length)} files):`));
          files.slice(0, 10).forEach(file => console.log(`  - ${colors.file(file)}`));
          if (files.length > 10) {
            console.log(colors.dim(`  ... and ${files.length - 10} more`));
          }
        }
      });

      // Provide recommendations
      if (recommendations.length > 0) {
        console.log(colors.infoMessage('\n💡 Recommendations:'));
        recommendations.forEach(rec => console.log(`  - ${rec}`));
      }

      if (aiAnalysis) {
        console.log(colors.aiMessage('\n🤖 AI Analysis of untracked files:'));
        console.log(aiAnalysis);
      }

      return data;

    } catch (error) {
      if (format === 'json') {
        outputData({ error: `Error analyzing untracked files: ${error.message}` }, format);
        return { error: error.message };
      }
      console.error(colors.errorMessage(`Error analyzing untracked files: ${error.message}`));
      throw error;
    }
  }

  async assessRepositoryHealth(config = {}) {
    if (!this.gitManager.isGitRepo) {
      const errorMsg = 'Not a git repository';
      if (config.format === 'json') {
        outputData({ error: errorMsg }, config.format);
        return;
      }
      console.log(colors.errorMessage(errorMsg));
      return;
    }

    try {
      console.log(colors.processingMessage('Assessing repository health...'));

      // Gather repository health metrics
      const healthMetrics = await this.gatherHealthMetrics();
      const healthScore = this.calculateHealthScore(healthMetrics);
      const recommendations = this.generateHealthRecommendations(healthMetrics);

      const data = {
        type: 'repository_health_assessment',
        timestamp: new Date().toISOString(),
        overallScore: healthScore.overall,
        grade: healthScore.grade,
        metrics: healthMetrics,
        recommendations,
        categories: {
          commitQuality: healthScore.commitQuality,
          branchHygiene: healthScore.branchHygiene,
          fileOrganization: healthScore.fileOrganization,
          activityLevel: healthScore.activityLevel
        }
      };

      if (config.format === 'json') {
        outputData(data, config.format);
        return data;
      }

      // Display health assessment
      console.log(colors.header('\n🏥 Repository Health Assessment:'));

      // Overall score
      const gradeColor = this.getGradeColor(healthScore.grade);
      console.log(colors.subheader(`\n📊 Overall Health: ${gradeColor(healthScore.grade)} (${colors.number(healthScore.overall)}/100)`));

      // Category breakdown
      console.log(colors.subheader('\n📋 Category Scores:'));
      console.log(`   ${colors.label('Commit Quality')}: ${colors.number(healthScore.commitQuality)}/100`);
      console.log(`   ${colors.label('Branch Hygiene')}: ${colors.number(healthScore.branchHygiene)}/100`);
      console.log(`   ${colors.label('File Organization')}: ${colors.number(healthScore.fileOrganization)}/100`);
      console.log(`   ${colors.label('Activity Level')}: ${colors.number(healthScore.activityLevel)}/100`);

      // Key metrics
      console.log(colors.subheader('\n📈 Key Metrics:'));
      console.log(`   ${colors.label('Average commit message length')}: ${colors.number(healthMetrics.avgCommitMessageLength)} chars`);
      console.log(`   ${colors.label('Recent commits')}: ${colors.number(healthMetrics.recentCommitCount)} (last 30 days)`);
      console.log(`   ${colors.label('Active branches')}: ${colors.number(healthMetrics.activeBranchCount)}`);
      console.log(`   ${colors.label('Untracked files')}: ${colors.number(healthMetrics.untrackedFileCount)}`);

      // Recommendations
      if (recommendations.length > 0) {
        console.log(colors.infoMessage('\n💡 Health Recommendations:'));
        recommendations.forEach(rec => console.log(`  - ${rec}`));
      }

      return data;

    } catch (error) {
      console.error(colors.errorMessage(`Error assessing repository health: ${error.message}`));
      if (config.format === 'json') {
        outputData({ error: error.message }, config.format);
        return { error: error.message };
      }
      return { error: error.message };
    }
  }

  // Helper methods
  categorizeUntrackedFiles(files) {
    const categories = {
      source: [],
      config: [],
      documentation: [],
      assets: [],
      temporary: [],
      other: []
    };

    files.forEach(file => {
      const ext = file.split('.').pop()?.toLowerCase();
      const path = file.toLowerCase();

      if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'rs', 'go'].includes(ext)) {
        categories.source.push(file);
      } else if (['json', 'yaml', 'yml', 'toml', 'ini', 'env'].includes(ext) || path.includes('config')) {
        categories.config.push(file);
      } else if (['md', 'txt', 'rst'].includes(ext) || path.includes('readme') || path.includes('doc')) {
        categories.documentation.push(file);
      } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'css', 'scss'].includes(ext)) {
        categories.assets.push(file);
      } else if (['tmp', 'temp', 'log', 'cache'].some(temp => path.includes(temp)) || file.startsWith('.')) {
        categories.temporary.push(file);
      } else {
        categories.other.push(file);
      }
    });

    return categories;
  }

  generateUntrackedRecommendations(categories) {
    const recommendations = [];

    if (categories.source?.length > 0) {
      recommendations.push('Consider adding source files to git or updating .gitignore');
    }
    if (categories.temporary?.length > 0) {
      recommendations.push('Add temporary files to .gitignore to keep repository clean');
    }
    if (categories.config?.length > 0) {
      recommendations.push('Review configuration files - add sensitive configs to .gitignore');
    }
    if (categories.documentation?.length > 0) {
      recommendations.push('Consider adding documentation files to the repository');
    }

    return recommendations;
  }

  async gatherHealthMetrics() {
    const recentCommits = this.gitManager.getRecentCommits(100);
    const branches = this.gitManager.getAllBranches();
    const untrackedFiles = this.gitManager.getUntrackedFiles();

    return {
      totalCommits: recentCommits.length,
      recentCommitCount: recentCommits.filter(c =>
        new Date(c.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length,
      avgCommitMessageLength: recentCommits.reduce((sum, c) => sum + c.subject.length, 0) / recentCommits.length || 0,
      activeBranchCount: branches.local?.length || 0,
      untrackedFileCount: untrackedFiles.length,
      hasGitignore: this.gitManager.hasFile('.gitignore'),
      hasReadme: this.gitManager.hasFile('README.md') || this.gitManager.hasFile('readme.md')
    };
  }

  calculateHealthScore(metrics) {
    let commitQuality = 100;
    let branchHygiene = 100;
    let fileOrganization = 100;
    let activityLevel = 100;

    // Commit quality assessment
    if (metrics.avgCommitMessageLength < 10) commitQuality -= 30;
    else if (metrics.avgCommitMessageLength < 20) commitQuality -= 15;

    // Branch hygiene
    if (metrics.activeBranchCount > 10) branchHygiene -= 20;
    if (metrics.activeBranchCount > 20) branchHygiene -= 30;

    // File organization
    if (!metrics.hasGitignore) fileOrganization -= 20;
    if (!metrics.hasReadme) fileOrganization -= 15;
    if (metrics.untrackedFileCount > 10) fileOrganization -= 20;

    // Activity level
    if (metrics.recentCommitCount === 0) activityLevel -= 50;
    else if (metrics.recentCommitCount < 5) activityLevel -= 20;

    const overall = Math.round((commitQuality + branchHygiene + fileOrganization + activityLevel) / 4);

    let grade = 'F';
    if (overall >= 90) grade = 'A';
    else if (overall >= 80) grade = 'B';
    else if (overall >= 70) grade = 'C';
    else if (overall >= 60) grade = 'D';

    return {
      overall: Math.max(0, overall),
      commitQuality: Math.max(0, commitQuality),
      branchHygiene: Math.max(0, branchHygiene),
      fileOrganization: Math.max(0, fileOrganization),
      activityLevel: Math.max(0, activityLevel),
      grade
    };
  }

  generateHealthRecommendations(metrics) {
    const recommendations = [];

    if (metrics.avgCommitMessageLength < 20) {
      recommendations.push('Write more descriptive commit messages (aim for 20+ characters)');
    }
    if (metrics.activeBranchCount > 10) {
      recommendations.push('Consider cleaning up old/merged branches');
    }
    if (!metrics.hasGitignore) {
      recommendations.push('Add a .gitignore file to exclude unwanted files');
    }
    if (!metrics.hasReadme) {
      recommendations.push('Add a README.md file to document your project');
    }
    if (metrics.untrackedFileCount > 5) {
      recommendations.push('Review and either commit or ignore untracked files');
    }
    if (metrics.recentCommitCount < 5) {
      recommendations.push('Consider more frequent commits for better project tracking');
    }

    return recommendations;
  }

  getGradeColor(grade) {
    const colors_map = {
      'A': colors.successMessage,
      'B': colors.successMessage,
      'C': colors.warningMessage,
      'D': colors.warningMessage,
      'F': colors.errorMessage
    };
    return colors_map[grade] || colors.infoMessage;
  }
}