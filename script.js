document.getElementById('github-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    const submitButton = document.getElementById('submit-button');
    if (submitButton.disabled) return; // Prevent multiple submissions
    submitButton.disabled = true;

    const username = document.getElementById('username').value;
    const token = document.getElementById('token').value;
    const progressIndicator = document.getElementById('progress-indicator');
    const progressBar = document.querySelector('.progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');
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
    submitButton.classList.add('hidden'); // Hide the submit button
    followersTable.classList.add('hidden');
    pagination.classList.add('hidden');
    tbody.innerHTML = '';
    progressBar.style.width = '0%';
    progressPercentage.textContent = '0%';
    errorMessage.textContent = '';

    // Update table headers to only include Name and Total Stars
    tableHeaders.innerHTML = '<th>Name</th><th>Total Stars</th>';

    try {
        // Fetch followers and filter out those you are already following back
        const followers = await fetchFollowers(username, token);
        const notFollowingBack = await fetchNotFollowingBack(username, token, followers);
        const sortedFollowers = await fetchAdditionalInfo(token, notFollowingBack, progressBar, progressPercentage);

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
        submitButton.classList.remove('hidden'); // Ensure the reset button is visible
        submitButton.addEventListener('click', () => location.reload());

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
    const following = [];
    let page = 1;
    const perPage = 100;

    // Fetch all users you are following, handling pagination
    while (true) {
        const response = await fetch(`https://api.github.com/users/${username}/following?per_page=${perPage}&page=${page}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch following');
        }
        const data = await response.json();
        if (data.length === 0) break;
        following.push(...data);
        page++;
    }

    const followingLogins = new Set(following.map(user => user.login));
    return followers.filter(follower => !followingLogins.has(follower.login));
}

// Fetch additional info for followers and update progress bar
async function fetchAdditionalInfo(token, followers, progressBar, progressPercentage) {
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

            return followerInfo;
        });

        const batchResults = await Promise.all(batchPromises);
        followersWithInfo.push(...batchResults);

        // Update progress bar and percentage
        const progress = ((i + batchSize) / totalFollowers) * 100;
        progressBar.style.width = `${progress}%`;
        progressPercentage.textContent = `${Math.min(progress, 100).toFixed(2)}%`;
        await delay(1000); // Delay to avoid hitting rate limit
    }

    return followersWithInfo;
}

// Toggle light and dark modes
document.getElementById('mode-toggle').addEventListener('change', function() {
    document.body.classList.toggle('light-mode');
});
