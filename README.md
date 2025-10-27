# 🏃 Nudge - AI-Powered Training Planner

A React-based web application that integrates with Strava to help athletes plan and track their training. The app provides activity tracking, training calendar visualization, and AI-powered insights.

## Features

- 🔐 **Strava OAuth Integration** - Securely connect your Strava account
- 📊 **Activity Tracking** - View all your Strava activities with detailed metrics
- 📅 **Training Calendar** - Visualize your training schedule on an interactive calendar
- 🤖 **AI Insights** - Get personalized training recommendations (coming soon)
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile devices

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Strava account
- Strava API credentials (Client ID and Client Secret)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/neerajrd25/nudge.git
cd nudge
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Strava API credentials

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Create a new application (if you haven't already)
3. Note your **Client ID** and **Client Secret**
4. Set the **Authorization Callback Domain** to `localhost` (for local development)

### 4. Configure environment variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file and add your Strava credentials:

```env
VITE_STRAVA_CLIENT_ID=your_client_id_here
VITE_STRAVA_CLIENT_SECRET=your_client_secret_here
VITE_STRAVA_REDIRECT_URI=http://localhost:5173/callback
```

### 5. Run the development server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage

1. **Connect to Strava**: Click the "Connect with Strava" button on the home page
2. **Authorize**: Allow Nudge to access your Strava data
3. **View Activities**: Navigate to the Activities page to see your recent workouts
4. **Training Calendar**: Check out the Calendar page to visualize your training schedule

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run preview` - Preview the production build
- `npm run lint` - Run ESLint

## Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client for API requests
- **React Calendar** - Calendar component
- **Strava API** - Athlete data and activities

## Project Structure

```
nudge/
├── src/
│   ├── components/      # Reusable components
│   ├── pages/          # Page components
│   │   ├── Home.jsx
│   │   ├── Callback.jsx
│   │   ├── Activities.jsx
│   │   └── TrainingCalendar.jsx
│   ├── utils/          # Utility functions
│   │   └── stravaApi.js
│   ├── App.jsx         # Main app component
│   └── main.jsx        # Entry point
├── public/             # Static assets
├── .env.example        # Environment variables template
└── package.json        # Dependencies and scripts
```

## Security Notes

- Never commit your `.env` file or expose your Strava API credentials
- The app stores access tokens in localStorage for convenience in local development
- For production use, implement more secure token storage (e.g., httpOnly cookies)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Built with [Strava API](https://developers.strava.com/)
- Powered by [React](https://react.dev/) and [Vite](https://vitejs.dev/)

