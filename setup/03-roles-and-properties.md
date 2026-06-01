# Setup Guide 3: Create Roles and System Properties

This guide walks you through creating the required roles and configuring all system properties for the Operational Risk Intelligence application.

## Prerequisites
- Completed **Setup Guide 2: Create Custom Tables**
- Access to create roles and modify system properties
- Administrator role (required for property management)

---

## Part 1: Create Roles

### Create Role: x_ori_admin

1. In the search bar, type `sys_user_role.list` and press Enter
2. Click **New** to create a new role
3. Fill in the details:

| Field | Value |
|-------|-------|
| **Name** | x_ori_admin |
| **Description** | ORI Application Administrator - full access to all ORI tables and functions |

4. Click **Insert and Stay** (or **Submit**)
5. Keep the role open for reference

### Create Role: x_ori_analyst

1. While still in the role list, click **New** again
2. Fill in the details:

| Field | Value |
|-------|-------|
| **Name** | x_ori_analyst |
| **Description** | ORI Application Analyst - read and write access to analysis runs and recommendations |

3. Click **Insert** to create the role
4. Note both role names for use in ACL configuration (Setup Guide 4)

---

## Part 2: Create System Properties

System properties store configuration values for the ORI application. Each property will be created in the `System Properties` table.

### Navigate to System Properties

1. In the search bar, type `sys_properties.list` and press Enter
2. You should see the System Properties list view

### Create Each Property

For each property below, click **New** and fill in the fields as specified:

---

### Property 1: x_ori.active

| Field | Value |
|-------|-------|
| **Name** | x_ori.active |
| **Value** | true |
| **Description** | Enables/disables the ORI application |
| **Private** | false |

Click **Insert** to create.

---

### Property 2: x_ori.lookback_days

| Field | Value |
|-------|-------|
| **Name** | x_ori.lookback_days |
| **Value** | 30 |
| **Description** | Number of days to look back for incident analysis |
| **Private** | false |

Click **Insert** to create.

---

### Property 3: x_ori.min_incidents_per_cluster

| Field | Value |
|-------|-------|
| **Name** | x_ori.min_incidents_per_cluster |
| **Value** | 3 |
| **Description** | Minimum number of incidents required to form a cluster |
| **Private** | false |

Click **Insert** to create.

---

### Property 4: x_ori.min_confidence_threshold

| Field | Value |
|-------|-------|
| **Name** | x_ori.min_confidence_threshold |
| **Value** | 0.6 |
| **Description** | Minimum AI confidence score (0.0-1.0) for recommendations |
| **Private** | false |

Click **Insert** to create.

---

### Property 5: x_ori.excluded_categories

| Field | Value |
|-------|-------|
| **Name** | x_ori.excluded_categories |
| **Value** | Service Request,Access Management,User Administration |
| **Description** | Comma-separated incident categories to exclude from analysis |
| **Private** | false |

Click **Insert** to create.

---

### Property 6: x_ori.excluded_subcategories

| Field | Value |
|-------|-------|
| **Name** | x_ori.excluded_subcategories |
| **Value** | Password Reset,Account Unlock,New User Setup,Duplicate |
| **Description** | Comma-separated incident subcategories to exclude from analysis |
| **Private** | false |

Click **Insert** to create.

---

### Property 7: x_ori.noise_keywords

| Field | Value |
|-------|-------|
| **Name** | x_ori.noise_keywords |
| **Value** | password reset,access request,unlock account,duplicate,new user,vpn access,user creation,permission request,onboarding |
| **Description** | Comma-separated keywords to filter out noise from incident descriptions |
| **Private** | false |

Click **Insert** to create.

---

### Property 8: x_ori.claude_model

| Field | Value |
|-------|-------|
| **Name** | x_ori.claude_model |
| **Value** | claude-opus-4-8 |
| **Description** | Claude AI model to use for analysis and recommendations |
| **Private** | false |

Click **Insert** to create.

---

### Property 9: x_ori.claude_max_tokens

| Field | Value |
|-------|-------|
| **Name** | x_ori.claude_max_tokens |
| **Value** | 1024 |
| **Description** | Maximum tokens for Claude API responses |
| **Private** | false |

Click **Insert** to create.

---

### Property 10: x_ori.claude_api_key (IMPORTANT)

This property stores your Anthropic API key. It must be private to protect credentials.

1. Click **New** in the system properties list
2. Fill in the fields:

| Field | Value |
|-------|-------|
| **Name** | x_ori.claude_api_key |
| **Value** | [Leave blank for now - see instructions below] |
| **Description** | Anthropic Claude API key for AI analysis |
| **Private** | **true** |

3. **IMPORTANT:** Check the **Private** checkbox (this encrypts the value)
4. Click **Insert**
5. After creation, open the property record again
6. Click **Edit** next to the **Value** field
7. Paste your Anthropic API key (obtain from https://console.anthropic.com/)
8. Click **Save**

---

### Property 11: x_ori.reviewer_group

| Field | Value |
|-------|-------|
| **Name** | x_ori.reviewer_group |
| **Value** | [Leave empty - see setup instructions below] |
| **Description** | sys_user_group sys_id of the group responsible for reviewing recommendations |
| **Private** | false |

Click **Insert** to create.

**Post-Creation Setup for reviewer_group:**

1. In ServiceNow, navigate to a user group you want to use as the reviewer group (e.g., "IT Support" or "Service Desk")
2. Note the **Name** of the group
3. In the user group's details, look for the **sys_id** field in the URL or information panel
4. Go back to the `x_ori.reviewer_group` property
5. Click **Edit** and paste the sys_id value in the **Value** field
6. Click **Save**

---

## Part 3: Verify Properties

### Verification Script

After all properties are created, use this script to verify they are readable by your application code.

1. Open the **System Diagnostics > Script - Background** (search for `sys_script_background`)
2. In the script area, paste the following code:

```javascript
// Verify ORI Properties
var propertyNames = [
    'x_ori.active',
    'x_ori.lookback_days',
    'x_ori.min_incidents_per_cluster',
    'x_ori.min_confidence_threshold',
    'x_ori.excluded_categories',
    'x_ori.excluded_subcategories',
    'x_ori.noise_keywords',
    'x_ori.claude_model',
    'x_ori.claude_max_tokens',
    'x_ori.claude_api_key',
    'x_ori.reviewer_group'
];

gs.info('=== ORI Property Verification ===');

propertyNames.forEach(function(propName) {
    var value = gs.getProperty(propName);
    var displayValue = (propName.indexOf('api_key') > -1) ? '[REDACTED]' : value;
    gs.info(propName + ' = ' + displayValue);
});

gs.info('=== Verification Complete ===');
```

3. Click **Execute Script**
4. In the **Output** section, you should see all properties listed with their values
5. The `x_ori.claude_api_key` will show `[REDACTED]` due to privacy

---

## Part 4: Network Configuration

### Allow Outbound API Calls to Anthropic

The ORI application needs to make outbound HTTPS requests to Anthropic's API. Configure your instance to allow this:

1. In the search bar, type `outbound_http_request` and press Enter
2. Look for any existing records for `api.anthropic.com`
3. If none exists, create a new outbound request configuration:
   - **Protocol:** HTTPS
   - **Host:** api.anthropic.com
   - **Port:** 443

4. Alternatively, verify with your ServiceNow administrator that outbound HTTPS requests to `api.anthropic.com` are permitted

---

## Next Steps

Once all roles and properties are created and verified, proceed to **Setup Guide 4: Configure ACLs (Access Control Lists)** to define permission boundaries for each role.

## Troubleshooting

| Issue | Resolution |
|-------|-----------|
| Property list is empty | Ensure you are on the `sys_properties` table, not a different properties table |
| Cannot create property | Verify you have Administrator role; some instances restrict property creation |
| API key not saving | Ensure the **Private** checkbox is checked and you have permission to edit private properties |
| Verification script fails | Check the property names exactly match the values in the table above (case-sensitive) |
| Properties show null in code | Wait a few seconds for system cache to update, then try again |
