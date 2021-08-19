/**
 * PROJECTS
 */

const CREDENTIALS = config.credentials;
const projectsList = document.getElementById("project-list");

/**
 * Start page functions
 */
async function startPageFunctions() {

    // After short delay, show loading state (skip loading state entirely if very quick loading)
    const loadingTimeout = setTimeout(() => {
        projectsList.style.opacity = "";
    }, 1000);

    try {

        // Get Projects
        const projects = await client.getProjects(GROUP_ALIAS);
        clearTimeout(loadingTimeout);

        // Logout if Projects is undefined (due to no connection)
        // If no Projects are available for the User's Team, an empty Array [] is returned.
        if (!projects) {
            handleUnauthorizedUser("No connection found.");
            return;
        }

        // Render Projects
        renderProjects(projects);
    } catch (error) {
        handleGenericError(error);
        handleUnauthorizedUser();
    }
};

/**
 * Render Projects to container
 */
function renderProjects(projects) {

    // Clear loading state, show list
    projectsList.innerHTML = "";
    projectsList.style.opacity = "";

    // Empty state
    if (!projects.length) {
        projectsList.innerHTML = `
            <div class="empty-projects">
                <p>No Projects available.</p>
            </div>
        `;
        return;
    }

    // Loop out Projects
    for (let index = 0; index < projects.length; index++) {
        const project = projects[index];
        const name = project.alias ? project.alias : project.name;
        const description = project.description;
        let imagePath = project.absoluteImagePath;
        if (!imagePath) {
            imagePath = "dist/img/placeholder.png";
        }

        const markup = `
            <div class="inner">
                <div class="project-image">
                    <div class="image" style="background-image: url('${imagePath}');"></div>
                </div>
                <h4 class="project-name">${name}</h4>
                ${description && '<div class="project-description">' + description + "</div>"}
                <div class="project-action">Create</div>
            </div>
        `;

        // Create Project item
        const item = document.createElement("a");
        item.classList.add("project-item");
        item.style.setProperty("--index", index);
        item.setAttribute("data-id", project.id);
        item.setAttribute("data-name", project.name);
        item.href = `run.html?project=${project.name}`;
        item.title = "Create Specification: " + name;
        item.innerHTML = markup;

        projectsList.appendChild(item);

        // Animate entrance (hidden by default)
        item.classList.add("animate");
    }
}
