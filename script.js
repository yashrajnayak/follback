document.addEventListener('DOMContentLoaded', function() {
    // Initialize dark/light mode based on user preference
    const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const modeToggle = document.getElementById('mode-toggle');
    
    if (!prefersDarkMode) {
        document.body.classList.add('light-mode');
        modeToggle.checked = true;
    }
    
    // Form submission handler
    document.getElementById('github-form').addEventListener('submit', async function(event) {
        event.preventDefault();
        const submitButton = document.getElementById('submit-button');
        if (submitButton.disabled) return; // Prevent multiple submissions
        submitButton.disabled = true;
        submitButton.textContent = 'Loading...';

        const username = document.getElementById('username').value;
        const token = document.getElementById('token').value;
        const progressContainer = document.getElementById('progress-container');
        const progressIndicator = document.getElementById('progress-indicator');
        const progressBar = document.querySelector('.progress-bar');
        const progressPercentage = document.getElementById('progress-percentage');
        const followersTable = document.getElementById('followers-table');
        const resultsSection = document.getElementById('results-section');
        const tbody = followersTable.querySelector('tbody');
        const errorMessage = document.getElementById('error-message');
        const pagination = document.getElementById('pagination');
        const prevPageButton = document.getElementById('prev-page');
        const nextPageButton = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');

        let currentPage = 1;
        const itemsPerPage = 100;

        // Show progress indicator and reset table and pagination
        progressContainer.classList.remove('hidden');
        submitButton.classList.add('loading');
        resultsSection.classList.add('hidden');
        pagination.classList.add('hidden');
        tbody.innerHTML = '';
        progressBar.style.width = '0%';
        progressPercentage.textContent = '0%';
        errorMessage.textContent = '';
        errorMessage.classList.add('hidden');

        try {
            // Validate token format
            if (!token.match(/^ghp_[a-zA-Z0-9]{36}$/) && !token.match(/^github_pat_[a-zA-Z0-9_]{22,}$/)) {
                throw new Error('Invalid token format. Please use a GitHub Personal Access Token.');
            }

            // Fetch followers and filter out those you are already following back
            const followers = await fetchFollowers(username, token);
            
            if (followers.length === 0) {
                throw new Error('No followers found for this username.');
            }
            
            const notFollowingBack = await fetchNotFollowingBack(username, token, followers);
            
            if (notFollowingBack.length === 0) {
                throw new Error('Great job! You are already following back all your followers.');
            }
            
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
                    
                    // Create name cell with avatar
                    const nameCell = document.createElement('td');
                    nameCell.className = 'user-cell';
                    
                    const userLink = document.createElement('a');
                    userLink.href = follower.html_url;
                    userLink.target = '_blank';
                    userLink.className = 'user-link';
                    
                    if (follower.avatar_url) {
                        const avatar = document.createElement('img');
                        avatar.src = follower.avatar_url;
                        avatar.alt = `${follower.login}'s avatar`;
                        avatar.className = 'user-avatar';
                        userLink.appendChild(avatar);
                    }
                    
                    const userName = document.createElement('span');
                    userName.textContent = follower.name || follower.login;
                    userLink.appendChild(userName);
                    
                    if (follower.login && follower.login !== follower.name) {
                        const userLogin = document.createElement('span');
                        userLogin.textContent = `@${follower.login}`;
                        userLogin.className = 'user-login';
                        userLink.appendChild(userLogin);
                    }
                    
                    nameCell.appendChild(userLink);
                    row.appendChild(nameCell);
                    
                    // Create stars cell
                    const starsCell = document.createElement('td');
                    starsCell.textContent = follower.totalStars.toLocaleString();
                    starsCell.className = 'stars-cell';
                    row.appendChild(starsCell);
                    
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
            prevPageButton.onclick = () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderPage(currentPage);
                    window.scrollTo(0, resultsSection.offsetTop - 20);
                }
            };

            nextPageButton.onclick = () => {
                if (currentPage < Math.ceil(sortedFollowers.length / itemsPerPage)) {
                    currentPage++;
                    renderPage(currentPage);
                    window.scrollTo(0, resultsSection.offsetTop - 20);
                }
            };

            // Show the followers table and hide the form inputs
            resultsSection.classList.remove('hidden');
            document.querySelector('.form-section').classList.add('hidden');
            
            // Add reset button
            const resetButton = document.createElement('button');
            resetButton.textContent = 'New Search';
            resetButton.className = 'reset-button';
            resetButton.onclick = () => location.reload();
            resultsSection.insertBefore(resetButton, resultsSection.firstChild);

        } catch (error) {
            console.error('Error fetching data:', error);
            errorMessage.textContent = error.message || 'An error occurred while fetching data. Please try again.';
            errorMessage.classList.remove('hidden');
        } finally {
            progressContainer.classList.add('hidden');
            submitButton.disabled = false;
            submitButton.textContent = 'Find Followers You Don\'t Follow Back';
            submitButton.classList.remove('loading');
        }
    });

    // Fetch followers from GitHub API
    async function fetchFollowers(username, token) {
        let allFollowers = [];
        let page = 1;
        const perPage = 100;
        
        try {
            while (true) {
                const response = await fetch(`https://api.github.com/users/${username}/followers?per_page=${perPage}&page=${page}`, {
                    headers: { 'Authorization': `token ${token}` }
                });
                
                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('Authentication failed. Please check your token.');
                    } else if (response.status === 404) {
                        throw new Error('User not found. Please check the username.');
                    } else {
                        throw new Error(`GitHub API error: ${response.status}`);
                    }
                }
                
                const data = await response.json();
                if (data.length === 0) break;
                allFollowers.push(...data);
                if (data.length < perPage) break;
                page++;
            }
            
            return allFollowers;
        } catch (error) {
            console.error('Error in fetchFollowers:', error);
            throw error;
        }
    }

    // Fetch users you are following and filter out those who are following you back
    async function fetchNotFollowingBack(username, token, followers) {
        const following = [];
        let page = 1;
        const perPage = 100;

        try {
            // Fetch all users you are following, handling pagination
            while (true) {
                const response = await fetch(`https://api.github.com/users/${username}/following?per_page=${perPage}&page=${page}`, {
                    headers: { 'Authorization': `token ${token}` }
                });
                
                if (!response.ok) {
                    throw new Error('Failed to fetch following users.');
                }
                
                const data = await response.json();
                if (data.length === 0) break;
                following.push(...data);
                if (data.length < perPage) break;
                page++;
            }

            const followingLogins = new Set(following.map(user => user.login));
            return followers.filter(follower => !followingLogins.has(follower.login));
        } catch (error) {
            console.error('Error in fetchNotFollowingBack:', error);
            throw error;
        }
    }

    // Fetch additional info for followers and update progress bar
    async function fetchAdditionalInfo(token, followers, progressBar, progressPercentage) {
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        const followersWithInfo = [];
        const totalFollowers = followers.length;
        const batchSize = 5;

        // Load cache from localStorage
        let cache = JSON.parse(localStorage.getItem('followerStarsCache')) || {};

        // Function to update cache
        const updateCache = (login, data) => {
            cache[login] = { 
                ...data,
                timestamp: Date.now() 
            };
            localStorage.setItem('followerStarsCache', JSON.stringify(cache));
        };

        try {
            for (let i = 0; i < totalFollowers; i += batchSize) {
                const batch = followers.slice(i, i + batchSize);
                const batchPromises = batch.map(async follower => {
                    // Check cache first
                    const cachedData = cache[follower.login];
                    const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

                    if (cachedData && (Date.now() - cachedData.timestamp) < cacheExpiry) {
                        return {
                            login: follower.login,
                            html_url: follower.html_url,
                            name: cachedData.name,
                            avatar_url: cachedData.avatar_url,
                            totalStars: cachedData.totalStars
                        };
                    }
                    
                    // Fetch user data if not in cache
                    const userResponse = await fetch(follower.url, {
                        headers: { 'Authorization': `token ${token}` }
                    });
                    
                    if (!userResponse.ok) {
                        return {
                            login: follower.login,
                            html_url: follower.html_url,
                            totalStars: 0
                        };
                    }
                    
                    const userData = await userResponse.json();

                    // Fetch total stars for each follower's repositories with pagination
                    let totalStars = 0;
                    let repoPage = 1;
                    
                    while (true) {
                        const starsResponse = await fetch(`${userData.repos_url}?page=${repoPage}&per_page=100`, {
                            headers: { 'Authorization': `token ${token}` }
                        });
                        
                        if (!starsResponse.ok) break;
                        
                        const repos = await starsResponse.json();
                        if (repos.length === 0) break;
                        totalStars += repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
                        if (repos.length < 100) break;
                        repoPage++;
                    }

                    const followerInfo = {
                        login: userData.login,
                        html_url: userData.html_url,
                        name: userData.name,
                        avatar_url: userData.avatar_url,
                        totalStars: totalStars
                    };

                    // Update cache
                    updateCache(userData.login, followerInfo);

                    return followerInfo;
                });

                try {
                    const batchResults = await Promise.all(batchPromises);
                    followersWithInfo.push(...batchResults);
                } catch (error) {
                    console.error('Error processing batch:', error);
                    // Continue with next batch even if one fails
                }

                // Update progress bar and percentage
                const progress = Math.min(((i + batchSize) / totalFollowers) * 100, 100);
                progressBar.style.width = `${progress}%`;
                progressPercentage.textContent = `${progress.toFixed(0)}%`;
                
                // Add a small delay to avoid hitting rate limit
                if (i + batchSize < totalFollowers) {
                    await delay(1000);
                }
            }

            return followersWithInfo;
        } catch (error) {
            console.error('Error in fetchAdditionalInfo:', error);
            throw error;
        }
    }

    // Toggle light and dark modes
    document.getElementById('mode-toggle').addEventListener('change', function() {
        document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
    });

    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
            modeToggle.checked = true;
        } else {
            document.body.classList.remove('light-mode');
            modeToggle.checked = false;
        }
    }
});
