document.getElementById('github-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    const submitButton = document.getElementById('submit-button');
    if (submitButton.disabled) return; // Prevent multiple submissions
    submitButton.disabled = true;

    const username = document.getElementById('username').value;
    const token = document.getElementById('token').value;
    const includeBio = document.getElementById('bio').checked;
    const includeOrgs = document.getElementById('organizations').checked;
    const progressIndicator = document.getElementById('progress-indicator');
    const progressBar = document.querySelector('.progress-bar');
    const followersTable = document.getElementById('followers-table');
    const tbody = followersTable.querySelector('tbody');
    const tableHeaders = document.getElementById('table-headers');
    const errorMessage = document.getElementById('error-message');
    const pagination = document.getElementById('pagination');
    const prevPageButton = document.getElementById('prev-page');
    const nextPageButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    let currentPage = 1;
    const itemsPerPage = 100;

    // Show progress indicator and reset table and pagination
    progressIndicator.classList.remove('hidden');
    followersTable.classList.add('hidden');
    pagination.classList.add('hidden');
    tbody.innerHTML = '';
    progressBar.style.width = '0%';
    errorMessage.textContent = '';

    // Update table headers based on selected options
    tableHeaders.innerHTML = '<th>Name</th><th>Total Stars</th>';
    if (includeBio) tableHeaders.innerHTML += '<th class="bio-column">Bio</th>';
    if (includeOrgs) tableHeaders.innerHTML += '<th class="orgs-column">Organizations</th>';

    try {
        // Fetch followers and filter out those you are already following back
        const followers = await fetchFollowers(username, token);
        const notFollowingBack = await fetchNotFollowingBack(username, token, followers);
        const sortedFollowers = await fetchAdditionalInfo(token, notFollowingBack, progressBar, includeBio, includeOrgs);

        // Sort followers by total stars
        sortedFollowers.sort((a, b) => b.totalStars - a.totalStars);

        // Function to render a specific page of followers
        function renderPage(page) {
            tbody.innerHTML = '';
            const start = (page - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageFollowers = sortedFollowers.slice(start, end);

            pageFollowers.forEach(follower => {
                const row = document.createElement('tr');
                row.innerHTML = `<td><a href="${follower.html_url}" target="_blank">${follower.name || follower.login}</a></td>`;
                row.innerHTML += `<td>${follower.totalStars}</td>`;
                if (includeBio) row.innerHTML += `<td class="bio-column">${follower.bio || ''}</td>`;
                if (includeOrgs) row.innerHTML += `<td class="orgs-column">${follower.organizations.join(', ')}</td>`;
                tbody.appendChild(row);
            });

            pageInfo.textContent = `Page ${page} of ${Math.ceil(sortedFollowers.length / itemsPerPage)}`;
            prevPageButton.disabled = page === 1;
            nextPageButton.disabled = page === Math.ceil(sortedFollowers.length / itemsPerPage);
        }

        // Render the first page
        renderPage(currentPage);
        if (sortedFollowers.length > itemsPerPage) {
            pagination.classList.remove('hidden');
        }

        // Add event listeners for pagination buttons
        prevPageButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderPage(currentPage);
            }
        });

        nextPageButton.addEventListener('click', () => {
            if (currentPage < Math.ceil(sortedFollowers.length / itemsPerPage)) {
                currentPage++;
                renderPage(currentPage);
            }
        });

        // Show the followers table and hide the form inputs
        followersTable.classList.remove('hidden');
        document.getElementById('username').classList.add('hidden');
        document.getElementById('token').classList.add('hidden');
        submitButton.textContent = 'Reset';
        submitButton.addEventListener('click', () => location.reload());

        // Show checkboxes and add event listeners to toggle columns
        const checkboxes = document.querySelector('.checkboxes');
        checkboxes.classList.remove('hidden');
        document.getElementById('bio').addEventListener('change', toggleColumn);
        document.getElementById('organizations').addEventListener('change', toggleColumn);

        // Hide Bio and Organizations columns if they were not checked
        if (!includeBio) {
            document.querySelectorAll('.bio-column').forEach(col => col.classList.add('hidden'));
        }
        if (!includeOrgs) {
            document.querySelectorAll('.orgs-column').forEach(col => col.classList.add('hidden'));
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        errorMessage.textContent = 'An error occurred while fetching data. Please try again.';
        errorMessage.classList.remove('hidden');
    } finally {
        progressIndicator.classList.add('hidden');
        submitButton.disabled = false; // Re-enable the button
    }
});

// Fetch followers from GitHub API
async function fetchFollowers(username, token) {
    const response = await fetch(`https://api.github.com/users/${username}/followers`, {
        headers: { 'Authorization': `token ${token}` }
    });
    if (!response.ok) {
        throw new Error('Failed to fetch followers');
    }
    return response.json();
}

// Fetch users you are following and filter out those who are following you back
async function fetchNotFollowingBack(username, token, followers) {
    const response = await fetch(`https://api.github.com/users/${username}/following`, {
        headers: { 'Authorization': `token ${token}` }
    });
    if (!response.ok) {
        throw new Error('Failed to fetch following');
    }
    const following = await response.json();
    const followingLogins = new Set(following.map(user => user.login));
    return followers.filter(follower => !followingLogins.has(follower.login));
}

// Fetch additional info for followers and update progress bar
async function fetchAdditionalInfo(token, followers, progressBar, includeBio, includeOrgs) {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const followersWithInfo = [];
    const totalFollowers = followers.length;
    const batchSize = 5;

    for (let i = 0; i < totalFollowers; i += batchSize) {
        const batch = followers.slice(i, i + batchSize);
        const batchPromises = batch.map(async follower => {
            const userResponse = await fetch(follower.url, {
                headers: { 'Authorization': `token ${token}` }
            });
            const userData = await userResponse.json();

            const followerInfo = {
                login: userData.login,
                html_url: userData.html_url,
                name: userData.name,
                totalStars: 0
            };

            // Fetch total stars for each follower's repositories
            const starsResponse = await fetch(userData.repos_url, {
                headers: { 'Authorization': `token ${token}` }
            });
            const repos = await starsResponse.json();
            followerInfo.totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);

            // Include bio if selected
            if (includeBio) {
                followerInfo.bio = userData.bio;
            }

            // Include organizations if selected
            if (includeOrgs) {
                const orgsResponse = await fetch(userData.organizations_url, {
                    headers: { 'Authorization': `token ${token}` }
                });
                const orgs = await orgsResponse.json();
                followerInfo.organizations = orgs.map(org => org.login);
            }

            return followerInfo;
        });

        const batchResults = await Promise.all(batchPromises);
        followersWithInfo.push(...batchResults);

        // Update progress bar
        progressBar.style.width = `${((i + batchSize) / totalFollowers) * 100}%`;
        await delay(1000); // Delay to avoid hitting rate limit
    }

    return followersWithInfo;
}

// Toggle visibility of Bio and Organizations columns
function toggleColumn(event) {
    const columnClass = event.target.id === 'bio' ? 'bio-column' : 'orgs-column';
    const columns = document.querySelectorAll(`.${columnClass}`);
    columns.forEach(column => {
        column.classList.toggle('hidden');
    });
}

// Toggle dark/light mode
document.getElementById('toggle-mode').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
});
