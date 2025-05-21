# Directory Scanner Utility

An interactive command-line tool for scanning and managing files in directories. This utility helps you categorize files by their extensions, view their contents, and manage them efficiently.

## Features

- 🔍 Scans directories and categorizes files by extension
- 📊 Shows file sizes and counts for each category
- 📂 Optional recursive scanning of subdirectories
- 👀 View text file contents directly in the terminal
- 🗑️ Delete files with confirmation
- 🎨 Colored terminal output for better visibility
- ⏭️ Skip common system directories (node_modules, .git, etc.)

## Prerequisites

- Node.js (version 12 or higher recommended)
- npm (Node Package Manager)

## Installation

1. Clone or download this repository
2. Install dependencies:
```bash
npm install
```

## Usage

Basic usage:
```bash
node script.js <directory_path>
```

To enable recursive scanning of subdirectories:
```bash
node script.js <directory_path> --fullscan
```

### Examples:
```bash
# Scan current directory
node script.js .

# Scan a specific directory with recursive scanning
node script.js /path/to/directory --fullscan
```

## Interactive Menu

The tool provides an interactive menu that allows you to:
- Browse files by extension categories
- See file counts and total sizes for each category
- View contents of text files
- Delete files with confirmation
- Navigate through directories easily

## Excluded Directories

By default, the following directories are excluded from scanning to improve performance:
- node_modules
- venv
- .git
- .vscode
- __pycache__
- build
- dist
- out
- bin
- obj
- target
- vendor
- tmp/temp
- logs
- coverage
- docs
- test/tests
- examples

## Dependencies

- `fs` (Node.js built-in): File system operations
- `path` (Node.js built-in): Path manipulations
- `chalk`: Terminal string styling
- `inquirer`: Interactive command line interface

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.