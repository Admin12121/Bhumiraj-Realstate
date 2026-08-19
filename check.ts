import { userProfileSchema, adminUserSchema, staffMemberSchema, adminAuditSchema } from "./packages/contracts/src/index"
const cookie = process.env["C"]!
const base = "http://nginx/api/v1"
const get = async (p: string) => (await fetch(`${base}${p}`, { headers: { cookie } })).json()

const cases: [string, string, any][] = [
  ["/profiles/me", "userProfileSchema", userProfileSchema],
  ["/admin/users?page=1", "adminUserSchema", adminUserSchema],
  ["/admin/staff", "staffMemberSchema", staffMemberSchema],
  ["/admin/audit?page=1", "adminAuditSchema", adminAuditSchema],
]
for (const [path, name, schema] of cases) {
  const body: any = await get(path)
  const target = body.items ? body.items[0] : body
  if (!target) { console.log(`SKIP ${path} (no rows)`); continue }
  const r = schema.safeParse(target)
  console.log(r.success ? `PASS ${path} (${name})` : `FAIL ${path} (${name}) :: ${JSON.stringify(r.error.issues.slice(0,3))}`)
}
