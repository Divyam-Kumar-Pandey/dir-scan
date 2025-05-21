// Import necessary Node.js modules
const fs = require('fs');
const path = require('path'); // PATH module
// For colorizing console output.
// The .default fallback is added to handle potential differences in how
// Chalk's CommonJS export behaves across different versions or environments,
// especially with Chalk v5+.
const chalk = require('chalk').default || require('chalk');
// For interactive command-line interface.
// Similar to chalk, adding .default fallback for inquirer to handle
// potential differences in how its CommonJS export behaves.
const inquirer = require('inquirer').default || require('inquirer');

// Define a list of directory names to exclude from scanning.
// These are common directories that often contain many files
// but are usually not relevant for general file categorization.
const EXCLUDE_DIRS = [
    'node_modules',
    'venv',
    '.git',
    '.vscode',
    '__pycache__',
    'build',
    'dist',
    'out',
    'bin',
    'obj',
    'target', // Common in Rust/Java projects
    'vendor', // Common in Go/PHP projects
    'tmp',
    'temp',
    'log',
    'logs',
    'coverage',
    'docs', // Often contains generated documentation
    'test', // Often contains test data/fixtures
    'tests',
    'examples'
];

/**
 * Scans a given directory and categorizes files by their extensions,
 * returning an object with categories and file details. This function
 * now recursively scans subdirectories based on the `fullScan` parameter
 * and respects an exclude list.
 * @param {string} directoryPath The path to the directory to scan.
 * @param {boolean} [fullScan=false] If true, recursively scans subdirectories.
 * @returns {Promise<Object|null>} A promise that resolves to an object
 * containing categorized files, or null if an error occurs.
 */
async function categorizeFiles(directoryPath, fullScan = false) {
    // Only log the initial scan message, not for every recursive call
    // The `arguments.length` check is a heuristic to determine if it's the top-level call.
    // A more robust way might be to pass an internal flag.
    if (arguments.length <= 1 || (arguments.length === 2 && typeof arguments[1] === 'boolean')) {
        console.log(chalk.blue(`\nScanning directory: ${directoryPath}${fullScan ? ' (Full Scan Enabled)' : ''}\n`));
    }

    // Check if the directory exists
    if (!fs.existsSync(directoryPath)) {
        // For recursive calls, we don't want to error out if a subdirectory
        // was deleted during the process or is inaccessible.
        if (arguments.length <= 1 || (arguments.length === 2 && typeof arguments[1] === 'boolean')) {
            console.error(chalk.red(`Error: Directory not found at "${directoryPath}"`));
        }
        return null;
    }

    // Check if the provided path is actually a directory
    const stats = fs.statSync(directoryPath);
    if (!stats.isDirectory()) {
        if (arguments.length <= 1 || (arguments.length === 2 && typeof arguments[1] === 'boolean')) {
            console.error(chalk.red(`Error: "${directoryPath}" is not a directory.`));
        }
        return null;
    }

    const categories = {}; // Object to store categorized files

    try {
        // Read the contents of the directory
        const filesAndDirs = await fs.promises.readdir(directoryPath);

        // Iterate over each file/directory in the list
        for (const item of filesAndDirs) {
            const itemPath = path.join(directoryPath, item);
            const itemName = path.basename(itemPath);

            try {
                const itemStats = await fs.promises.stat(itemPath);

                if (itemStats.isFile()) {
                    // If it's a file, get its extension
                    const ext = path.extname(item).toLowerCase(); // .txt, .jpg, .js, etc.
                    const extension = ext === '' ? 'no_extension' : ext; // Handle files without extensions

                    // Initialize array for the extension if it doesn't exist
                    if (!categories[extension]) {
                        categories[extension] = [];
                    }

                    // Add file details to the category
                    categories[extension].push({
                        name: item,
                        fullPath: itemPath,
                        size: itemStats.size // Size in bytes
                    });
                } else if (itemStats.isDirectory()) {
                    // Check if the directory is in the exclude list
                    if (EXCLUDE_DIRS.includes(itemName)) {
                        console.log(chalk.gray(`  Skipping excluded directory: ${itemName}`));
                        continue; // Skip this directory
                    }

                    // If it's a directory and fullScan is enabled, recursively call categorizeFiles
                    if (fullScan) {
                        const subCategories = await categorizeFiles(itemPath, fullScan); // Pass fullScan
                        if (subCategories) {
                            // Merge sub-categories into the main categories object
                            for (const ext in subCategories) {
                                if (!categories[ext]) {
                                    categories[ext] = [];
                                }
                                categories[ext].push(...subCategories[ext]);
                            }
                        }
                    } else {
                        // Log that a directory is skipped because fullScan is false
                        // This message can be commented out if too verbose
                        // console.log(chalk.gray(`  Skipping directory (fullScan is false): ${itemName}`));
                    }
                }

            } catch (statErr) {
                console.warn(chalk.yellow(`  Warning: Could not get stats for "${item}" (${statErr.message})`));
            }
        }
        return categories;

    } catch (readDirErr) {
        console.error(chalk.red(`Error reading directory "${directoryPath}": ${readDirErr.message}`));
        return null;
    }
}

/**
 * Displays the main interactive menu for file categories.
 * @param {Object} categories The categorized file data.
 * @param {string} directoryPath The path to the scanned directory.
 * @param {boolean} fullScan Indicates if the initial scan was a full scan.
 */
async function startInteractiveMenu(categories, directoryPath, fullScan) {
    if (Object.keys(categories).length === 0) {
        console.log(chalk.gray("No files found in this directory to categorize."));
        return;
    }

    const categoryChoices = Object.keys(categories).map(ext => {
        const totalSize = categories[ext].reduce((sum, file) => sum + file.size, 0);
        const totalSizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
        const displayExt = ext === 'no_extension' ? 'Files with No Extension' : ext.toUpperCase();
        return {
            name: `${displayExt} (${categories[ext].length} files, ${totalSizeInMB} MB)`,
            value: ext,
            rawSize: totalSize // Store raw size for sorting
        };
    });

    // Sort categories by total size in decreasing order
    categoryChoices.sort((a, b) => b.rawSize - a.rawSize);

    // Remove rawSize property before displaying, as it's only for sorting
    categoryChoices.forEach(choice => delete choice.rawSize);

    categoryChoices.push(new inquirer.Separator());
    categoryChoices.push({ name: chalk.red('Exit'), value: 'exit' });

    while (true) {
        const { selectedCategory } = await inquirer.prompt({
            type: 'list',
            name: 'selectedCategory',
            message: chalk.cyan('Select a file category:'),
            choices: categoryChoices
        });

        if (selectedCategory === 'exit') {
            console.log(chalk.green('Exiting file categorizer. Goodbye!'));
            break;
        }

        await handleCategorySelection(selectedCategory, categories[selectedCategory], directoryPath, fullScan);
    }
}

/**
 * Handles the selection of a file category, displaying files within it.
 * @param {string} categoryName The name of the selected category (extension).
 * @param {Array<Object>} filesInCategory An array of file objects in the category.
 * @param {string} directoryPath The path to the scanned directory.
 * @param {boolean} fullScan Indicates if the initial scan was a full scan.
 */
async function handleCategorySelection(categoryName, filesInCategory, directoryPath, fullScan) {
    const displayExt = categoryName === 'no_extension' ? 'Files with No Extension' : categoryName.toUpperCase();
    console.log(chalk.magenta(`\n--- Files in ${displayExt} ---`));

    // Sort files in decreasing order of size before mapping to choices
    filesInCategory.sort((a, b) => b.size - a.size);

    const fileChoices = filesInCategory.map(file => {
        const sizeInKB = (file.size / 1024).toFixed(2);
        return {
            name: `${file.name} (${sizeInKB} KB)`,
            value: file.fullPath
        };
    });

    fileChoices.push(new inquirer.Separator());
    fileChoices.push({ name: chalk.gray('Go Back to Categories'), value: 'back' });

    while (true) {
        const { selectedFile } = await inquirer.prompt({
            type: 'list',
            name: 'selectedFile',
            message: chalk.yellow('Select a file or go back:'),
            choices: fileChoices
        });

        if (selectedFile === 'back') {
            break; // Go back to the main category menu
        }

        await handleFileAction(selectedFile, directoryPath);
        // After an action (like deletion), re-scan the directory to reflect changes.
        // This will update the 'categories' object for the next iteration of the main menu.
        // Note: The `categorizeFiles` function now handles recursive scanning.
        const updatedCategories = await categorizeFiles(directoryPath, fullScan); // Pass fullScan here
        if (updatedCategories) {
            // If re-categorization was successful, break out of this loop
            // to re-enter the main category selection with updated data.
            break;
        } else {
            // If re-categorization failed (e.g., directory no longer exists), exit.
            console.error(chalk.red("Failed to re-scan directory after action. Exiting."));
            process.exit(1);
        }
    }
}

/**
 * Handles actions for a selected file (view or delete).
 * @param {string} filePath The full path to the selected file.
 * @param {string} directoryPath The path to the scanned directory.
 */
async function handleFileAction(filePath, directoryPath) {
    const fileName = path.basename(filePath);
    const { action } = await inquirer.prompt({
        type: 'list',
        name: 'action',
        message: chalk.green(`What do you want to do with "${fileName}"?`),
        choices: [
            { name: 'View Content', value: 'view' },
            { name: 'Delete File', value: 'delete' },
            { name: 'Go Back to File List', value: 'back' }
        ]
    });

    switch (action) {
        case 'view':
            await viewFileContent(filePath);
            break;
        case 'delete':
            await deleteFile(filePath);
            break;
        case 'back':
            // Do nothing, will loop back to file list
            break;
    }
}

/**
 * Attempts to view the content of a text file.
 * @param {string} filePath The path to the file to view.
 */
async function viewFileContent(filePath) {
    console.log(chalk.blue(`\n--- Content of ${path.basename(filePath)} ---\n`));
    try {
        const content = await fs.promises.readFile(filePath, { encoding: 'utf8', flag: 'r' });
        console.log(chalk.white(content));
        console.log(chalk.blue(`\n--- End of Content ---\n`));
    } catch (err) {
        if (err.code === 'EISDIR') {
            console.error(chalk.red(`Error: "${path.basename(filePath)}" is a directory, not a file.`));
        } else if (err.code === 'EACCES') {
            console.error(chalk.red(`Error: Permission denied to read "${path.basename(filePath)}".`));
        } else {
            console.error(chalk.red(`Error reading file "${path.basename(filePath)}": ${err.message}`));
            console.warn(chalk.yellow("Note: This might not be a text file or it's too large to display."));
        }
    }
    await inquirer.prompt({
        type: 'input',
        name: 'continue',
        message: chalk.gray('Press Enter to continue...')
    });
}

/**
 * Deletes a specified file after confirmation.
 * @param {string} filePath The path to the file to delete.
 */
async function deleteFile(filePath) {
    const fileName = path.basename(filePath);
    const { confirmDelete } = await inquirer.prompt({
        type: 'confirm',
        name: 'confirmDelete',
        message: chalk.red(`Are you sure you want to delete "${fileName}"? This cannot be undone!`),
        default: false
    });

    if (confirmDelete) {
        try {
            await fs.promises.unlink(filePath);
            console.log(chalk.green(`Successfully deleted: "${fileName}"`));
        } catch (err) {
            console.error(chalk.red(`Error deleting "${fileName}": ${err.message}`));
        }
    } else {
        console.log(chalk.gray(`Deletion of "${fileName}" cancelled.`));
    }
    await inquirer.prompt({
        type: 'input',
        name: 'continue',
        message: chalk.gray('Press Enter to continue...')
    });
}

// --- Main execution flow ---
// You can provide the directory path as a command-line argument.
// Example: node categorize_files.js /path/to/your/directory [--fullscan]
const targetDirectory = process.argv[2];
const shouldFullScan = process.argv.includes('--fullscan'); // Check for the --fullscan flag

if (!targetDirectory) {
    console.log(chalk.red("Usage: node categorize_files.js <directory_path> [--fullscan]"));
    console.log(chalk.red("  <directory_path>: The path to the directory you want to scan."));
    console.log(chalk.red("  --fullscan: Optional flag to enable recursive scanning of subdirectories."));
    console.log(chalk.red("Please provide the path to the directory you want to scan."));
} else {
    (async () => {
        const categories = await categorizeFiles(targetDirectory, shouldFullScan); // Pass shouldFullScan
        if (categories) {
            await startInteractiveMenu(categories, targetDirectory, shouldFullScan); // Pass fullScan to menu
        }
    })();
}
