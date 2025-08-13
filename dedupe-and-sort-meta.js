#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Remove duplicate IDs from meta.json and arrange them alphabetically
 * Usage: node dedupe-and-sort-meta.js [meta.json path]
 */

function dedupeAndSortMeta(filePath = "meta.json") {
  console.log(`🔧 Processing ${filePath}...`);

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read and parse the JSON file
    const fileContent = fs.readFileSync(filePath, "utf8");
    let data;

    try {
      data = JSON.parse(fileContent);
    } catch (parseError) {
      throw new Error(`Invalid JSON in ${filePath}: ${parseError.message}`);
    }

    // Validate that data is an array
    if (!Array.isArray(data)) {
      throw new Error(`Expected an array in ${filePath}, got ${typeof data}`);
    }

    console.log(`📊 Found ${data.length} total entries`);

    // Track duplicates and stats
    const seenIds = new Set();
    const duplicates = [];
    const unique = [];

    // Remove duplicates (keep first occurrence)
    data.forEach((item, index) => {
      if (!item || typeof item !== "object") {
        console.warn(`⚠️  Skipping invalid item at index ${index}:`, item);
        return;
      }

      if (!item.id) {
        console.warn(
          `⚠️  Skipping item without ID at index ${index}:`,
          item.name || "Unknown"
        );
        return;
      }

      if (seenIds.has(item.id)) {
        duplicates.push({
          id: item.id,
          name: item.name || "Unknown",
          originalIndex: index,
        });
        console.warn(
          `🔍 Duplicate ID found: "${item.id}" (${item.name || "Unknown"})`
        );
      } else {
        seenIds.add(item.id);
        unique.push(item);
      }
    });

    // Sort alphabetically by ID
    unique.sort((a, b) => {
      const idA = a.id.toLowerCase();
      const idB = b.id.toLowerCase();
      return idA.localeCompare(idB);
    });

    // Create backup
    const backupPath = `${filePath}.backup.${Date.now()}`;
    fs.writeFileSync(backupPath, fileContent, "utf8");
    console.log(`💾 Backup created: ${backupPath}`);

    // Write the cleaned and sorted data
    const newContent = JSON.stringify(unique, null, 2);
    fs.writeFileSync(filePath, newContent, "utf8");

    // Report results
    console.log("\n✅ Processing completed successfully!");
    console.log(`📈 Statistics:`);
    console.log(`   • Original entries: ${data.length}`);
    console.log(`   • Duplicates removed: ${duplicates.length}`);
    console.log(`   • Final entries: ${unique.length}`);
    console.log(`   • Entries sorted alphabetically by ID`);

    if (duplicates.length > 0) {
      console.log(`\n🗑️  Removed duplicates:`);
      duplicates.forEach((dup) => {
        console.log(`   • "${dup.id}" (${dup.name})`);
      });
    }

    // Verify the result
    const firstFew = unique.slice(0, 5).map((item) => item.id);
    const lastFew = unique.slice(-5).map((item) => item.id);
    console.log(
      `\n🔤 ID range: ${firstFew[0]} ... ${lastFew[lastFew.length - 1]}`
    );

    return {
      original: data.length,
      duplicatesRemoved: duplicates.length,
      final: unique.length,
      duplicates: duplicates,
    };
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    process.exit(1);
  }
}

// CLI usage
if (require.main === module) {
  const filePath = process.argv[2] || "meta.json";
  dedupeAndSortMeta(filePath);
}

module.exports = dedupeAndSortMeta;
