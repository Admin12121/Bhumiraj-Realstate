# RBAC and resource-policy matrix

| Capability | Guest | User | Agent | Agency manager | Moderator | Admin | Super admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Browse published listings/profiles | yes | yes | yes | yes | yes | yes | yes |
| Save/follow/message/inquire | no | own account | own account | own account | own account | own account | own account |
| Create a listing | no | verified own property | verified own property | agency policy | policy | policy | policy |
| Edit listing | no | owner + allowed state | owner/assigned | agency resource | moderation only | moderation/override | override |
| Submit for review | no | owner | owner/assigned | agency resource | no | no | no |
| Publish/reject listing | no | no | no | no | yes | yes | yes |
| Register/place auction bid | no | eligible only | eligible only | eligible only | eligible only | eligible only | eligible only |
| Pause/cancel auction | no | no | no | no | policy-limited | yes | yes |
| Manage agency members | no | no | no | agency scope | no | override | override |
| Ban/change global role | no | no | no | no | limited moderation | yes except protected roles | yes |
| Change super-admin role/settings | no | no | no | no | no | no | yes |

Every row is additionally constrained by lifecycle status, ownership, agency membership, listing/auction state, verification and fresh-security requirements.
