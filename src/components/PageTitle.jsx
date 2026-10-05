import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const routeTitles = {
  '/': 'PromptCommit | Private AI Prompt Testing & Version Control',
  '/login': 'PromptCommit | Sign In',
  '/signup': 'PromptCommit | Create Account',
  '/app': 'PromptCommit | Dashboard',
  '/app/prompts': 'PromptCommit | Prompt Library',
  '/app/create': 'PromptCommit | Create Prompt',
  '/app/playground': 'PromptCommit | Playground',
  '/app/versions': 'PromptCommit | Version History',
  '/app/compare': 'PromptCommit | Compare Prompts',
  '/app/toolkit': 'PromptCommit | AI Toolkit',
  '/app/collections': 'PromptCommit | Collections',
  '/app/favorites': 'PromptCommit | Favorites',
  '/app/collaboration': 'PromptCommit | Collaboration',
  '/app/analytics': 'PromptCommit | Analytics',
  '/app/settings': 'PromptCommit | Settings',
};

export const PageTitle = () => {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;

    let title = routeTitles[pathname];
    if (!title) {
      if (pathname.startsWith('/invite/')) {
        title = 'PromptCommit | Accept Invitation';
      } else {
        title = 'PromptCommit | Page Not Found';
      }
    }

    document.title = title;

    // Set meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      document.head.appendChild(metaDescription);
    }
    metaDescription.content = 'PromptCommit is an AI prompt testing and collaboration platform for creating, testing, versioning, and improving prompts.';
  }, [location]);

  return null;
};
