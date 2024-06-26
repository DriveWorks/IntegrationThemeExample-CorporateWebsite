# DriveWorks Live - Integration Theme Example - Corporate Website
### Release: 19.1
#### Minimum DriveWorks Version: 18.1

An example of a full Corporate Website built upon the DriveWorks Live Integration Theme API.
Its features are based on the Web Theme's "Corporate Skin".

This template is designed to be configured and used as is, or the starting point for a larger application.

Please note: DriveWorks are not accepting pull requests for this example.  
Join our [online community](https://my.driveworks.co.uk) for discussion, resources and to suggest other examples.

### Features:
- Connects to the DriveWorks Live Integration Theme API
- Login Screen - Customizable login screen, with credentials attached to a config file
- Projects View - Renders a list of available Projects
    - Shown on successful login by default - redirect configurable
- Run View - Render and transition Specifications
    - Load custom assets matching the current Project name. See /custom-project-assets
        - Implement advanced customizations using JavaScript and CSS
- Details View - View Specification details and access documents
- History View - Search and filter Specifications
- "Query" Function - create new or edit existing Specifications through a URL query
    - Similar to the [DriveWorks Live "Integration Module"](https://docs.driveworkspro.com/topic/IntegrationModuleLive)
    - Examples:
        - /query?run={ProjectName}
        - /query?specification={SpecificationName}
        - /query?specification={SpecificationName}&transition={TransitionName}

### To use:
1. Clone this repository, or download as a .zip

2. Enter your Integration Theme details into `config.js`
    * `serverUrl` - The URL that hosts your Integration Theme, including any ports.
    * `groupAlias` - The public alias created for the Group containing the data to display - as configured in DriveWorksConfigUser.xml.
        * This *must* be specified for each Group you wish to use.
        * This allows you to mask the true Group name publicly, if desired.
        * See [Integration Theme Settings](https://docs.driveworkspro.com/Topic/IntegrationThemeSettings) for additional guidance.
    * `specificationPingInterval` - [optional] The interval at which to 'ping' the server automatically
        * This ensures a session is kept alive during inactivity, if desired.
    * *Optional*:
        * Configure various redirects (login, logout, specification close/cancel)
        * Configure update intervals (Details view)
        * Configure 'Query' function settings and defaults

3. Host the example locally or on a remote server.
    * Ensure `<corsOrigins>` in DriveWorksConfigUser.xml permits request from this location.
    See [Integration Theme Settings](https://docs.driveworkspro.com/Topic/IntegrationThemeSettings) for additional guidance.

### Troubleshooting:

If encountering any issues, please check the browser's console for error messages (F12).  

If you are unable to use the dynamic library loading demonstrated in this example:
1. In all .html files, uncomment "Option A" & replace "YOUR-DRIVEWORKS-LIVE-SERVER-URL.COM" with the URL of your own DriveWorks Live server that is serving `DriveWorksLiveIntegrationClient.min.js` - including any ports.
    * This should be the URL that hosts the Integration Theme, and serves it's landing page.
    * To check that this URL is correct, attempt to load DriveWorksLiveIntegrationClient.min.js in a browser. It should return a minified code library.
2. Remove the "Option B" `<script>` tag.

### Potential Issues:

* When serving this example for a domain different to your DriveWorks Live server, e.g. api.my-site.com from www.company.com, 'SameSite' cookie warnings may be thrown when the Client SDK attempts to store the current session id in a cookie.
    * This appears as "Error: 401 Unauthorized" in the browser console, even with the correct configuration set.
    * To resolve:
        * Ensure you are running DriveWorks 18.2 or above
        * Ensure HTTPS is enabled in DriveWorks Live's settings
        * Ensure a valid SSL certificate has been configured via DriveWorksConfigUser.xml.
        * See [Integration Theme Settings](https://docs.driveworkspro.com/Topic/IntegrationThemeSettings) for additional guidance.

---

This source code has been made available to demonstrate how you can integrate with DriveWorks using the DriveWorks Live API.
This code is provided under the MIT license, for more details see LICENSE.md.

The example requires that you have the latest DriveWorks Live SDK installed, operational and remotely accessible.
