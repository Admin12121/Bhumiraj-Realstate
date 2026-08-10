import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const schemaPath = join(root, "packages/database/prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf8");
const errors = [];
const warnings = [];
const modelNames = new Set();
const models = new Map();

for (const match of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
  const [, name, body] = match;
  modelNames.add(name);
  const fields = new Map();
  const indexes = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    if (line.startsWith("@@")) {
      indexes.push(line);
      continue;
    }
    const field = line.match(/^(\w+)\s+([^\s]+)/);
    if (!field) continue;
    if (fields.has(field[1])) errors.push(`${name}: duplicate field ${field[1]}`);
    fields.set(field[1], { type: field[2].replace(/[?\[\]]/g, ""), line });
  }
  const hasFieldId = [...fields.values()].some(({ line }) => /\s@id(?:\s|$)/.test(line));
  const hasCompositeId = indexes.some((index) => index.startsWith("@@id("));
  if (!hasFieldId && !hasCompositeId) errors.push(`${name}: no @id or @@id detected`);
  models.set(name, { body, fields, indexes });
}

for (const [name, model] of models) {
  const relationScalarFields = new Set();
  for (const relation of model.body.matchAll(/@relation\([^)]*fields:\s*\[([^\]]+)\]/g)) {
    for (const fieldName of relation[1].split(",").map((value) => value.trim())) {
      relationScalarFields.add(fieldName);
      if (!model.fields.has(fieldName)) {
        errors.push(`${name}: relation references missing scalar field ${fieldName}`);
      }
    }
  }

  for (const fieldName of relationScalarFields) {
    const field = model.fields.get(fieldName);
    const indexed =
      field?.line.includes("@unique") ||
      field?.line.includes("@id") ||
      model.indexes.some((index) =>
        new RegExp(`^@@(?:index|unique|id)\\(\\[${fieldName}(?:,|\\])`).test(index),
      );
    if (!indexed) warnings.push(`${name}.${fieldName}: relation field has no leading index`);
  }
}

for (const critical of ["User", "Listing", "MediaAsset", "Auction", "Bid", "OutboxEvent", "AuditLog"]) {
  if (!models.has(critical)) errors.push(`critical model ${critical} is missing`);
}

const migrationsDirectory = join(root, "packages/database/prisma/migrations");
const migrationNames = readdirSync(migrationsDirectory).filter((name) => !name.startsWith("."));
if (new Set(migrationNames).size !== migrationNames.length) errors.push("duplicate migration directory names detected");

if (warnings.length) {
  console.warn("Prisma schema audit warnings:");
  for (const warning of warnings) console.warn(`  - ${warning}`);
}
if (errors.length) {
  console.error("Prisma schema audit failed:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`Prisma schema audit passed (${models.size} models, ${migrationNames.length} migrations).`);
