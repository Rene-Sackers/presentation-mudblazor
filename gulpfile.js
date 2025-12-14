//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// This file is pure AI slop, didn't feel like putting time into it, but it generates the HTML files from the markdown files.
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const gulp = require('gulp');
const rename = require('gulp-rename');
const connect = require('gulp-connect');
const fs = require('fs');
const path = require('path');
const through = require('through2');
const { marked } = require('marked');

// Configuration
const docsDir = './docs';
const outputDir = './docs/_build';

// Discover and process markdown files
function discoverMarkdownFiles() {
  const files = [];
  
  // Function to convert filename to URL-friendly name
  function toUrlName(filename) {
    return filename
      .replace(/\.md$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Function to convert directory name to URL-friendly name
  function toUrlDirName(dirname) {
    return dirname
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Function to extract title from filename
  function extractTitle(filename) {
    return filename.replace(/\.md$/, '');
  }
  
  // Scan root directory for markdown files
  const rootFiles = fs.readdirSync(docsDir)
    .filter(file => {
      const fullPath = path.join(docsDir, file);
      return file.endsWith('.md') && fs.statSync(fullPath).isFile();
    });
  
  // Process root level files (e.g., index.md -> index.html)
  rootFiles.forEach(file => {
    const title = extractTitle(file);
    files.push({
      src: file,
      dest: file === 'index.md' ? 'index.html' : `${toUrlName(file)}.html`,
      title: title,
      directory: null
    });
  });
  
  // Scan all first-level subdirectories
  const subdirs = fs.readdirSync(docsDir)
    .filter(file => {
      const fullPath = path.join(docsDir, file);
      return fs.statSync(fullPath).isDirectory() && file !== '_build';
    });
  
  subdirs.forEach(subdir => {
    const subdirPath = path.join(docsDir, subdir);
    const subdirFiles = fs.readdirSync(subdirPath)
      .filter(file => {
        const fullPath = path.join(subdirPath, file);
        return file.endsWith('.md') && fs.statSync(fullPath).isFile();
      })
      .sort(); // Sort alphabetically/numerically
    
    subdirFiles.forEach(file => {
      const title = extractTitle(file);
      const urlDirName = toUrlDirName(subdir);
      files.push({
        src: `${subdir}/${file}`,
        dest: `${urlDirName}/${toUrlName(file)}.html`,
        title: title,
        directory: subdir
      });
    });
  });
  
  return files;
}

// HTML template with navigation
function getHTMLTemplate(navMenu, content, title, filePath) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - MudBlazor Presentation</title>
    <link rel="stylesheet" href="${getRelativePath(filePath)}styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
</head>
<body>
    <a href="#" id="toggle-sidebar" class="hamburger-menu-icon" onclick="document.getElementById('sidebar').classList.toggle('open'); return false;">
        <span></span>
        <span></span>
        <span></span>
    </a>
    <div class="container">
        <nav class="sidebar" id="sidebar">
            <ul class="nav-menu">
${navMenu}
            </ul>
        </nav>
        <main class="content">
            <div class="markdown-body">
${content}
            </div>
        </main>
    </div>
    <script>
        // Highlight code blocks
        document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        });
        
        // Set active nav link
        const currentPath = window.location.pathname;
        const currentFile = currentPath.split('/').pop() || 'index.html';
        document.querySelectorAll('.nav-link').forEach(link => {
            const linkHref = link.getAttribute('href');
            const linkFile = linkHref.split('/').pop();
            if (linkFile === currentFile || 
                (currentFile === '' && linkFile === 'index.html') ||
                (currentPath.endsWith('/') && linkFile === 'index.html')) {
                link.classList.add('active');
            }
        });
    </script>
</body>
</html>`;
}

// Generate navigation menu HTML
function generateNavMenu(currentPage, allFiles) {
  // Determine if we're in a subdirectory
  const isInSubdir = currentPage.includes('/') && currentPage !== 'index.html';
  const basePath = isInSubdir ? '../' : '';
  
  // Separate root files and subdirectory files
  const rootFiles = allFiles.filter(f => f.directory === null);
  const subdirFiles = allFiles.filter(f => f.directory !== null);
  
  // Group subdirectory files by directory
  const filesByDir = {};
  subdirFiles.forEach(file => {
    if (!filesByDir[file.directory]) {
      filesByDir[file.directory] = [];
    }
    filesByDir[file.directory].push(file);
  });

  let navHTML = '';
  
  // Add root files to navigation
  rootFiles.forEach(file => {
    const href = `${basePath}${file.dest}`;
    const isActive = currentPage === file.dest;
    navHTML += `                <li><a href="${href}" class="nav-link ${isActive ? 'active' : ''}">${file.title}</a></li>\n`;
  });
  
  // Add sections for each subdirectory
  const sortedDirs = Object.keys(filesByDir).sort();
  sortedDirs.forEach(dirName => {
    const dirFiles = filesByDir[dirName];
    navHTML += `                <li class="nav-section">\n`;
    navHTML += `                    <span class="nav-section-title">${dirName}</span>\n`;
    navHTML += `                    <ul class="nav-submenu">\n`;
    
    dirFiles.forEach(file => {
      const href = `${basePath}${file.dest}`;
      const isActive = currentPage === file.dest;
      navHTML += `                        <li><a href="${href}" class="nav-link ${isActive ? 'active' : ''}">${file.title}</a></li>\n`;
    });
    
    navHTML += `                    </ul>\n`;
    navHTML += `                </li>`;
  });
  
  return navHTML;
}

// Get relative path for CSS based on current page depth
function getRelativePath(currentPage) {
  if (currentPage === 'index.html') {
    return '';
  } else if (currentPage.includes('/')) {
    // Any file in a subdirectory needs to go up one level
    return '../';
  }
  return '';
}

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true
});

// Transform markdown to HTML
function markdownToHTML() {
  return through.obj(function(file, enc, cb) {
    const markdown = file.contents.toString();
    const html = marked(markdown);
    file.contents = Buffer.from(html);
    cb(null, file);
  });
}

// Custom transform to wrap markdown HTML in full page template
function wrapInTemplate(navMenu, title, filePath) {
  return through.obj(function(file, enc, cb) {
    const content = file.contents.toString();
    const fullHTML = getHTMLTemplate(navMenu, content, title, filePath);
    file.contents = Buffer.from(fullHTML);
    cb(null, file);
  });
}

// Build task
gulp.task('build', function() {
  // Discover all markdown files
  const markdownFiles = discoverMarkdownFiles();
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Create output directories for all subdirectories
  const subdirs = new Set();
  markdownFiles.forEach(file => {
    if (file.directory) {
      const urlDirName = file.dest.split('/')[0];
      subdirs.add(urlDirName);
    }
  });
  
  subdirs.forEach(subdir => {
    const subdirPath = path.join(outputDir, subdir);
    if (!fs.existsSync(subdirPath)) {
      fs.mkdirSync(subdirPath, { recursive: true });
    }
  });

  // Copy CSS file to root and all subdirectories
  const cssDestinations = [outputDir];
  subdirs.forEach(subdir => {
    cssDestinations.push(path.join(outputDir, subdir));
  });
  
  cssDestinations.forEach(dest => {
    gulp.src(`${docsDir}/styles.css`)
      .pipe(gulp.dest(dest));
  });

  // Process each markdown file
  const tasks = markdownFiles.map(file => {
    const currentPage = file.dest;
    const navMenu = generateNavMenu(currentPage, markdownFiles);
    
    return gulp.src(`${docsDir}/${file.src}`)
      .pipe(markdownToHTML())
      .pipe(wrapInTemplate(navMenu, file.title, currentPage))
      .pipe(rename(file.dest))
      .pipe(gulp.dest(outputDir));
  });

  return Promise.all(tasks);
});

// Watch task
gulp.task('watch', function() {
  gulp.watch(`${docsDir}/**/*.md`, gulp.series('build'));
  gulp.watch(`${docsDir}/styles.css`, gulp.series('build'));
});

// Serve task
gulp.task('serve', function() {
  connect.server({
    root: outputDir,
    livereload: true,
    port: 8080
  });
  
  gulp.watch(`${docsDir}/**/*.md`, gulp.series('build'));
  gulp.watch(`${docsDir}/styles.css`, gulp.series('build'));
  gulp.watch(`${outputDir}/**/*.html`).on('change', function(file) {
    gulp.src(file.path).pipe(connect.reload());
  });
});

// Default task
gulp.task('default', gulp.series('build'));

