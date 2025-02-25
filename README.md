# Follback

Follback is a modern GitHub follower management tool that helps you discover and prioritize your most valuable followers. It identifies GitHub users who follow you but whom you're not following back, and ranks them based on their total repository stars - a key indicator of their influence and contributions to the open-source community.

![Follback Screenshot](https://github.com/user-attachments/assets/13e21e93-5092-4668-ad72-1d370c50d45b)

## Features

- **Smart Follower Discovery**: Identifies GitHub users who follow you but whom you're not following back.
- **Influence-Based Ranking**: Sorts followers by their total repository stars, helping you connect with influential developers.
- **User-Friendly Interface**: Clean, modern UI with both dark and light themes.
- **Responsive Design**: Works seamlessly on desktop and mobile devices.
- **Performance Optimized**: Uses caching to reduce API calls and improve load times.
- **Privacy Focused**: Your GitHub token is used only in your browser and never stored on any server.

## How It Works

1. Enter your GitHub username and personal access token
2. Follback fetches your followers and the users you're following
3. It identifies followers whom you are not following back
4. The app retrieves additional information about these users, including their total repository stars
5. Results are displayed in a table, sorted by total stars

## Getting Started

To use Follback, you'll need a GitHub Personal Access Token with the following scopes:
- `read:user` - To access user profile information
- `read:org` - To access organization information (optional)

You can create a token at [GitHub Developer Settings](https://github.com/settings/tokens).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
