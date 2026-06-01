# Setup Guide 1: Scaffold the Scoped Application

This guide walks you through creating the Operational Risk Intelligence (ORI) scoped application in ServiceNow Studio.

## Prerequisites
- Access to a ServiceNow PDI (Personal Developer Instance)
- Administrative or Developer role
- ServiceNow Studio available in your instance

## Steps

### 1. Access ServiceNow Studio
1. Log into your ServiceNow PDI
2. In the search bar at the top, type `studio` and press Enter
3. Click on **Studio** from the search results

### 2. Create a New Application
1. In the left panel, under **Create Application**, click **Create Application**
2. You will see the **Create Application** dialog

### 3. Fill in Application Details

Enter the following information in the dialog:

| Field | Value |
|-------|-------|
| **Application Name** | Operational Risk Intelligence |
| **Scope** | x_ori |
| **Version** | 1.0.0 |
| **Description** | AI-powered recurring incident pattern detection and Problem Management automation |

### 4. Create the Application
1. Click **Create** to generate the scoped application
2. ServiceNow will create the scope and initialize the application structure
3. You should see the new application **Operational Risk Intelligence** listed in the left panel under your scope **x_ori**

### 5. Verify the Application
1. In the left panel, expand the **x_ori** scope if needed
2. Confirm you can see your application listed
3. Note the scope name `x_ori` — this prefix will be used for all custom tables and configurations

## Next Steps
Once the application is created, proceed to **Setup Guide 2: Create Custom Tables** to define the four tables required by the ORI application.

## Troubleshooting

| Issue | Resolution |
|-------|-----------|
| Studio not visible in search | Check that you have Developer or Administrator role |
| Error creating application | Verify the scope name contains only lowercase letters and underscores |
| Application not appearing | Refresh the browser and navigate back to Studio |
