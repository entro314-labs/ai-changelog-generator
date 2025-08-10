#!/usr/bin/env node

// This file is for demonstration purposes and is not needed for production

/**
 * CLI Enhancement Demo
 * Demonstrates the new CLI styling capabilities
 */

import process from 'node:process'

import colors from '../constants/colors.js'
import { cliUtils, EnhancedConsole, ProgressBar, SimpleSpinner, TaskList } from './cli-ui.js'

async function demoBasicStyling() {
  EnhancedConsole.section('🎨 Basic Styling Demo')

  // Status messages
  EnhancedConsole.success('Operation completed successfully')
  EnhancedConsole.error('Something went wrong')
  EnhancedConsole.warn('This is a warning message')
  EnhancedConsole.info("Here's some information")
  EnhancedConsole.processing('Processing your request...')
  EnhancedConsole.ai('AI analysis complete')
  EnhancedConsole.metrics('Performance metrics updated')

  EnhancedConsole.space()
}

async function demoSpinners() {
  EnhancedConsole.section('⏳ Loading Indicators')

  const spinner = new SimpleSpinner('Analyzing codebase...')
  spinner.start()

  await new Promise((resolve) => setTimeout(resolve, 2000))
  spinner.succeed('Codebase analysis complete')

  const spinner2 = new SimpleSpinner('Connecting to AI service...')
  spinner2.start()

  await new Promise((resolve) => setTimeout(resolve, 1500))
  spinner2.warn('Connection timeout, using fallback')

  EnhancedConsole.space()
}

async function demoProgressBar() {
  EnhancedConsole.section('📊 Progress Indicators')

  const progress = new ProgressBar(100, 50)

  for (let i = 0; i <= 100; i += 5) {
    progress.update(i, i < 30 ? 'Initializing...' : i < 70 ? 'Processing...' : 'Finalizing...')
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  progress.finish('All files processed successfully')
  EnhancedConsole.space()
}

async function demoTaskList() {
  EnhancedConsole.section('✅ Task Management')

  const tasks = new TaskList([
    'Initialize project configuration',
    'Analyze git repository',
    'Process commit history',
    'Generate changelog content',
    'Validate output format',
  ])

  for (let i = 0; i < tasks.tasks.length; i++) {
    tasks.start(i)
    await new Promise((resolve) => setTimeout(resolve, 800))

    if (i === 2) {
      tasks.fail(i, 'Network timeout')
    } else {
      tasks.complete(i, `${Math.floor(Math.random() * 500)}ms`)
    }
  }

  tasks.summary()
  EnhancedConsole.space()
}

async function demoBoxes() {
  EnhancedConsole.section('📦 Boxed Content')

  EnhancedConsole.box(
    'System Information',
    `
Platform: ${process.platform}
Node.js: ${process.version}
Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB
Uptime: ${cliUtils.formatDuration(process.uptime() * 1000)}
  `,
    { borderStyle: 'rounded', borderColor: 'success' }
  )

  EnhancedConsole.box(
    'Configuration',
    `
${colors.label('AI Provider')}: ${colors.value('OpenAI GPT-4')}
${colors.label('Model')}: ${colors.value('gpt-4-turbo-preview')}
${colors.label('Max Tokens')}: ${colors.value('4096')}
${colors.label('Temperature')}: ${colors.value('0.7')}
  `,
    { borderStyle: 'double', borderColor: 'info' }
  )

  EnhancedConsole.space()
}

async function demoTables() {
  EnhancedConsole.section('📋 Data Tables')

  const commitData = [
    { hash: 'a1b2c3d', type: 'feat', message: 'Add new authentication system', files: 12 },
    { hash: 'e4f5g6h', type: 'fix', message: 'Fix memory leak in parser', files: 3 },
    { hash: 'i7j8k9l', type: 'docs', message: 'Update API documentation', files: 8 },
    { hash: 'm1n2o3p', type: 'refactor', message: 'Restructure service layer', files: 15 },
  ]

  EnhancedConsole.table(commitData, {
    headers: ['Hash', 'Type', 'Message', 'Files'],
    align: 'left',
  })

  EnhancedConsole.space()
}

async function demoFileList() {
  EnhancedConsole.section('📁 File Listings')

  const files = [
    'src/components/Header.tsx',
    'src/styles/main.scss',
    'docs/README.md',
    'package.json',
    'config/database.yml',
    'scripts/deploy.sql',
    'tests/auth.test.js',
  ]

  EnhancedConsole.fileList(files, 'Modified Files')
  EnhancedConsole.space()
}

async function demoMetrics() {
  EnhancedConsole.section('📈 Metrics Display')

  const metrics = {
    'Lines Added': colors.success('+247'),
    'Lines Removed': colors.error('-89'),
    'Files Changed': '12',
    'Complexity Score': colors.warning('7.2/10'),
    'Test Coverage': colors.success('94%'),
    'Bundle Size': '2.3MB',
    'Build Time': '12.4s',
  }

  EnhancedConsole.metrics(metrics)
  EnhancedConsole.space()
}

async function demoSymbols() {
  EnhancedConsole.section('🔤 Unicode Symbols')

  console.log('Status symbols:')
  console.log(`  ${colors.success(colors.symbols.success)} Success`)
  console.log(`  ${colors.error(colors.symbols.error)} Error`)
  console.log(`  ${colors.warning(colors.symbols.warning)} Warning`)
  console.log(`  ${colors.info(colors.symbols.info)} Information`)
  console.log(`  ${colors.highlight(colors.symbols.refresh)} Processing`)

  console.log('\nNavigation symbols:')
  console.log(`  ${colors.symbols.arrow} Next step`)
  console.log(`  ${colors.symbols.bullet} List item`)
  console.log(`  ${colors.symbols.play} Start process`)
  console.log(`  ${colors.symbols.stop} End process`)

  console.log('\nMath & special:')
  console.log(`  ${colors.symbols.plus} Addition`)
  console.log(`  ${colors.symbols.minus} Subtraction`)
  console.log(`  ${colors.symbols.multiply} Multiplication`)
  console.log(`  ${colors.symbols.degree} Temperature: 23${colors.symbols.degree}C`)
  console.log(`  ${colors.symbols.micro} Microsecond: 150${colors.symbols.micro}s`)

  EnhancedConsole.space()
}

async function runDemo() {
  console.clear()

  // Import gradient-string if available
  let gradientTitle = '🚀 AI Changelog Generator'
  try {
    const { default: gradient } = await import('gradient-string')
    gradientTitle = gradient(['#FF6B6B', '#4ECDC4', '#45B7D1'])(gradientTitle)
  } catch {
    gradientTitle = colors.highlight(gradientTitle)
  }

  // Welcome header
  console.log(
    colors.boxed(
      `
${gradientTitle}
${colors.secondary('Enhanced CLI Styling Demo')}

${colors.dim('Press Ctrl+C to exit at any time')}
  `,
      {
        title: 'Welcome',
        borderStyle: 'double',
        borderColor: 'highlight',
      }
    )
  )

  console.log('\n')

  try {
    await demoBasicStyling()
    await demoSpinners()
    await demoProgressBar()
    await demoTaskList()
    await demoBoxes()
    await demoTables()
    await demoFileList()
    await demoMetrics()
    await demoSymbols()

    // Final summary
    EnhancedConsole.divider('═', 70)
    console.log(
      colors.boxed(
        `
${colors.success('✨ Demo Complete!')}

These styling enhancements are now available throughout your CLI:

${colors.bullet} ${colors.highlight('Enhanced colors and symbols')}
${colors.bullet} ${colors.highlight('Loading spinners and progress bars')}
${colors.bullet} ${colors.highlight('Structured tables and boxes')}
${colors.bullet} ${colors.highlight('File type syntax highlighting')}
${colors.bullet} ${colors.highlight('Metrics and data visualization')}

${colors.dim('Integration examples can be found in:')}
${colors.file('src/shared/utils/cli-ui.js')}
${colors.file('src/shared/constants/colors.js')}
    `,
        {
          title: '🎯 Summary',
          borderStyle: 'rounded',
          borderColor: 'success',
        }
      )
    )
  } catch (error) {
    EnhancedConsole.error(`Demo failed: ${error.message}`)
    process.exit(1)
  }
}

// Export for use as a module
export {
  demoBasicStyling,
  demoSpinners,
  demoProgressBar,
  demoTaskList,
  demoBoxes,
  demoTables,
  demoFileList,
  demoMetrics,
  demoSymbols,
  runDemo,
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error)
}
