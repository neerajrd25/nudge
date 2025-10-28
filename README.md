# 🏃 Nudge - AI-Powered Training Planner

A React-based web application that integrates with Strava to help athletes plan and track their training. The app provides activity tracking, training calendar visualization, and AI-powered insights.

## Features

- 🔐 **Strava OAuth Integration** - Securely connect your Strava account
- 📊 **Activity Tracking** - View your last 3 months of Strava activities with detailed metrics
- 🔥 **Firebase Storage** - Automatically store activities in Firebase for persistent data
- 📅 **Training Calendar** - Visualize your training schedule on an interactive calendar
- 💬 **AI Chat** - Chat with AI about your training activities using Ollama models
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile devices

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Strava account
- Strava API credentials (Client ID and Client Secret)
- (Optional) Ollama installed locally for AI chat features
- A Firebase project (for storing activities)

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
VITE_OLLAMA_API_URL=http://localhost:11434
```

### 5. (Optional) Set up Ollama for AI Chat

To use the AI Chat feature, install and run Ollama:

1. Download and install Ollama from [ollama.ai](https://ollama.ai)
2. Pull a model (e.g., `ollama pull llama2` or `ollama pull mistral`)
3. Start the Ollama server: `ollama serve`

The chat feature will work with any Ollama-compatible model.
### 5. Set up Firebase (Required for storing activities)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Navigate to Project Settings (gear icon) > General
4. Under "Your apps", click the web icon (`</>`) to add a web app
5. Register your app and copy the Firebase configuration
6. Add your Firebase credentials to the `.env` file:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

7. In Firebase Console, go to Firestore Database and click "Create database"
8. Choose "Start in test mode" for development (update security rules for production)
9. Select a location for your database and click "Enable"

### 6. Run the development server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage

1. **Connect to Strava**: Click the "Connect with Strava" button on the home page
2. **Authorize**: Allow Nudge to access your Strava data
3. **View Activities**: Navigate to the Activities page to see your recent workouts
4. **Training Calendar**: Check out the Calendar page to visualize your training schedule
5. **AI Chat**: Use the Chat page to discuss your training with AI (requires Ollama)
3. **View Activities**: Navigate to the Activities page to see your recent workouts from the last 3 months
4. **Automatic Firebase Sync**: Activities are automatically stored in Firebase for persistence
5. **Training Calendar**: Check out the Calendar page to visualize your training schedule

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
- **Ollama** - Local AI models for chat functionality
- **Firebase/Firestore** - Cloud database for storing activities

## Project Structure

```
nudge/
├── src/
│   ├── components/      # Reusable components
│   ├── pages/          # Page components
│   │   ├── Home.jsx
│   │   ├── Callback.jsx
│   │   ├── Activities.jsx
│   │   ├── TrainingCalendar.jsx
│   │   └── Chat.jsx
│   ├── utils/          # Utility functions
│   │   ├── stravaApi.js
│   │   └── ollamaApi.js
│   │   ├── firebaseConfig.js
│   │   └── firebaseService.js
│   ├── App.jsx         # Main app component
│   └── main.jsx        # Entry point
├── public/             # Static assets
├── .env.example        # Environment variables template
└── package.json        # Dependencies and scripts
```

## Security Notes

- Never commit your `.env` file or expose your Strava API credentials or Firebase configuration
- The app stores access tokens in localStorage for convenience in local development
- For production use, implement more secure token storage (e.g., httpOnly cookies)
- Update Firebase security rules for production use - the default test mode rules allow unrestricted access

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Built with [Strava API](https://developers.strava.com/)
- Powered by [React](https://react.dev/) and [Vite](https://vitejs.dev/)

