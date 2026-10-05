import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { promptService } from '../services/promptService';
import { collectionService } from '../services/collectionService';
import { versionService } from '../services/versionService';
import { favoriteService } from '../services/favoriteService';
import { testService } from '../services/testService';
import { analyticsService } from '../services/analyticsService';

const PromptContext = createContext();

export const PromptProvider = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();

  const [prompts, setPrompts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [categories, setCategories] = useState(['Coding', 'Research', 'Marketing', 'Education', 'Engineering']);
  const [activities, setActivities] = useState([]);
  const [activePromptId, setActivePromptId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [backendError, setBackendError] = useState(null);

  const fetchRequestIdRef = useRef(0);
  const currentUserIdRef = useRef(currentUser?.id);
  currentUserIdRef.current = currentUser?.id;
  const favoriteMutationsRef = useRef(new Set());

  // Fetch prompts, collections, and activities whenever user logs in
  const refreshData = useCallback(async () => {
    const targetUserId = currentUser?.id;
    if (!isAuthenticated || !currentUser) {
      setPrompts([]);
      setCollections([]);
      setActivities([]);
      setActivePromptId(null);
      return;
    }

    const reqId = ++fetchRequestIdRef.current;
    setIsLoading(true);
    setBackendError(null);
    try {
      const [fetchedPrompts, fetchedCollections, fetchedOverview] = await Promise.all([
        promptService.getPrompts(),
        collectionService.getCollections(),
        analyticsService.getOverview().catch(() => null)
      ]);

      if (reqId !== fetchRequestIdRef.current || currentUserIdRef.current !== targetUserId) {
        return; // Stale request or user switched
      }

      setPrompts(fetchedPrompts || []);
      setCollections(fetchedCollections || []);

      if (fetchedOverview?.recentActivities) {
        setActivities(fetchedOverview.recentActivities);
      }

      // Collect unique categories (distinct from Collections)
      const distinctCats = new Set(['Coding', 'Research', 'Marketing', 'Education', 'Engineering']);
      (fetchedPrompts || []).forEach(p => {
        if (p.category) distinctCats.add(p.category);
      });
      setCategories(Array.from(distinctCats));

      if ((fetchedPrompts || []).length > 0) {
        setActivePromptId(prev => {
          if (prev && fetchedPrompts.some(p => p.id === prev)) return prev;
          return fetchedPrompts[0].id;
        });
      } else {
        setActivePromptId(null);
      }
    } catch (err) {
      if (reqId !== fetchRequestIdRef.current || currentUserIdRef.current !== targetUserId) {
        return;
      }
      console.error('Failed to load user prompts from backend:', err);
      setBackendError(err.message);
    } finally {
      if (reqId === fetchRequestIdRef.current && currentUserIdRef.current === targetUserId) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, currentUser]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const userPrompts = prompts;
  const ownedPrompts = prompts.filter(p => p.isOwner !== false);
  const sharedPrompts = prompts.filter(p => p.isOwner === false);
  const userFavorites = userPrompts.filter(p => p.isFavorite);
  const userActivities = activities;

  const activePrompt = userPrompts.find(p => p.id === activePromptId) || userPrompts[0] || null;

  // Add Prompt
  const addPrompt = async ({ title, description, category, tags, content, collection, collectionId, targetModel, isPrivate }) => {
    if (!currentUser) return null;

    try {
      const newPrompt = await promptService.createPrompt({
        title,
        description,
        category,
        tags,
        content,
        collection,
        collectionId,
        targetModel,
        isPrivate
      });

      setPrompts(prev => [newPrompt, ...prev]);
      setActivePromptId(newPrompt.id);

      // Register new category locally if needed
      if (category && !categories.includes(category)) {
        setCategories(c => [...c, category]);
      }

      // Refresh collections to update prompt counts
      collectionService.getCollections().then(cols => {
        if (cols) setCollections(cols);
      }).catch(() => {});

      // Add to activities
      const newAct = {
        id: `act_${newPrompt.id}`,
        userId: currentUser.id,
        type: 'create_prompt',
        title: `Created "${newPrompt.title}"`,
        meta: `Category: ${newPrompt.category}`,
        time: 'Just now',
        icon: 'PlusCircle',
        color: 'blue'
      };
      setActivities(prev => [newAct, ...prev]);

      return newPrompt;
    } catch (err) {
      console.error('Create prompt error:', err);
      throw err;
    }
  };

  // Update Prompt
  const updatePrompt = async (promptId, updatedFields) => {
    if (!promptId) return null;

    try {
      const updated = await promptService.updatePrompt(promptId, updatedFields);
      setPrompts(prev => prev.map(p => (p.id === promptId ? updated : p)));

      const newAct = {
        id: `act_edit_${Date.now()}`,
        userId: currentUser?.id,
        type: 'edit_prompt',
        title: `Updated "${updated.title}"`,
        meta: 'Modified prompt configuration & content',
        time: 'Just now',
        icon: 'FileCode',
        color: 'cyan'
      };
      setActivities(prev => [newAct, ...prev]);

      return updated;
    } catch (err) {
      console.error('Update prompt error:', err);
      throw err;
    }
  };

  // Add Version
  const addVersion = async (promptId, { commitMessage, description, content, versionTag, diffNotes, provider, model, targetModel }) => {
    try {
      const selectedModel = model || targetModel;
      const newVersion = await versionService.createVersion(promptId, {
        commitMessage,
        description,
        content,
        versionTag,
        diffNotes,
        provider,
        model: selectedModel,
        targetModel: selectedModel
      });

      setPrompts(prev => prev.map(p => {
        if (p.id !== promptId) return p;
        const currentVersions = p.versions || [];
        const updatedVersions = [newVersion, ...currentVersions.map(v => ({ ...v, isCurrent: false }))];
        return {
          ...p,
          version: newVersion.version,
          content: newVersion.content,
          targetModel: selectedModel || p.targetModel,
          versions: updatedVersions
        };
      }));

      const targetPrompt = prompts.find(p => p.id === promptId);
      const newAct = {
        id: `act_ver_${Date.now()}`,
        userId: currentUser?.id,
        type: 'new_version',
        title: `Created version for "${targetPrompt?.title || 'Prompt'}"`,
        meta: `Commit: ${commitMessage || 'Updated version'}`,
        time: 'Just now',
        icon: 'GitCommit',
        color: 'indigo'
      };
      setActivities(prev => [newAct, ...prev]);

      return newVersion;
    } catch (err) {
      console.error('Create version error:', err);
      throw err;
    }
  };

  // Restore Version
  const restoreVersion = async (promptId, versionTagOrId) => {
    try {
      const res = await versionService.restoreVersion(promptId, versionTagOrId);
      const restored = res.restoredVersion;

      setPrompts(prev => prev.map(p => {
        if (p.id !== promptId) return p;
        return {
          ...p,
          version: restored.version,
          content: restored.content,
          versions: (p.versions || []).map(v => ({
            ...v,
            isCurrent: v.version === restored.version || v.id === restored.id
          }))
        };
      }));

      const targetPrompt = prompts.find(p => p.id === promptId);
      const newAct = {
        id: `act_rest_${Date.now()}`,
        userId: currentUser?.id,
        type: 'restore_version',
        title: `Restored ${restored.version} on "${targetPrompt?.title || 'Prompt'}"`,
        meta: 'Rolled back prompt state',
        time: 'Just now',
        icon: 'RotateCcw',
        color: 'amber'
      };
      setActivities(prev => [newAct, ...prev]);

      return res;
    } catch (err) {
      console.error('Restore version error:', err);
      throw err;
    }
  };

  // Toggle Favorite
  const toggleFavorite = async (promptId) => {
    if (!promptId || favoriteMutationsRef.current.has(promptId)) {
      return;
    }
    favoriteMutationsRef.current.add(promptId);

    // Optimistic toggle
    setPrompts(prev => prev.map(p => (p.id === promptId ? { ...p, isFavorite: !p.isFavorite } : p)));

    try {
      const res = await favoriteService.toggleFavorite(promptId);
      setPrompts(prev => prev.map(p => (p.id === promptId ? { ...p, isFavorite: res.isFavorite } : p)));

      if (res.isFavorite) {
        const targetPrompt = prompts.find(p => p.id === promptId);
        const newAct = {
          id: `act_fav_${Date.now()}`,
          userId: currentUser?.id,
          type: 'favorite',
          title: `Added "${targetPrompt?.title || 'Prompt'}" to Favorites`,
          meta: `Category: ${targetPrompt?.category || 'General'}`,
          time: 'Just now',
          icon: 'Star',
          color: 'amber'
        };
        setActivities(prev => [newAct, ...prev]);
      }
      return res;
    } catch (err) {
      // Revert optimistic toggle
      setPrompts(prev => prev.map(p => (p.id === promptId ? { ...p, isFavorite: !p.isFavorite } : p)));
      console.error('Toggle favorite error:', err);
      throw err;
    } finally {
      favoriteMutationsRef.current.delete(promptId);
    }
  };

  // Rate Prompt
  const ratePrompt = async (promptId, newRating) => {
    try {
      const res = await promptService.ratePrompt(promptId, newRating);
      setPrompts(prev => prev.map(p => {
        if (p.id !== promptId) return p;
        return {
          ...p,
          rating: res.rating,
          ratingCount: res.ratingCount
        };
      }));
      return res;
    } catch (err) {
      console.error('Rate prompt error:', err);
      throw err;
    }
  };

  // Log / Execute Prompt Test
  const logPromptTest = async (promptId, modelName = 'gemini-3.6-flash', latencyMs = 200) => {
    try {
      setPrompts(prev => prev.map(p => {
        if (p.id !== promptId) return p;
        return {
          ...p,
          testCount: (p.testCount || 0) + 1,
          avgLatencyMs: Math.round(((p.avgLatencyMs || 200) + latencyMs) / 2)
        };
      }));

      const targetPrompt = prompts.find(p => p.id === promptId);
      const newAct = {
        id: `act_tst_${Date.now()}`,
        userId: currentUser?.id,
        type: 'test_prompt',
        title: `Tested "${targetPrompt?.title || 'Prompt'}"`,
        meta: `Model: ${modelName} • Latency: ${latencyMs}ms`,
        time: 'Just now',
        icon: 'PlayCircle',
        color: 'cyan'
      };
      setActivities(prev => [newAct, ...prev]);
    } catch (err) {
      console.error('Log test error:', err);
    }
  };

  // Share Prompt
  const sharePrompt = async (promptId, { email, role = 'Reviewer', name }) => {
    try {
      const res = await promptService.sharePrompt(promptId, { email, role, name });
      // Refresh prompt data to get latest shared list
      const updatedPrompt = await promptService.getPromptById(promptId);
      setPrompts(prev => prev.map(p => (p.id === promptId ? updatedPrompt : p)));
      return { success: true, message: res.message };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // Remove Shared User
  const removeSharedUser = async (promptId, memberId) => {
    try {
      await promptService.removeSharedUser(promptId, memberId);
      const updatedPrompt = await promptService.getPromptById(promptId);
      setPrompts(prev => prev.map(p => (p.id === promptId ? updatedPrompt : p)));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // Update Share Role
  const updateShareRole = async (promptId, memberId, newRole) => {
    const prompt = prompts.find(p => p.id === promptId);
    const member = (prompt?.sharedWith || []).find(m => m.id === memberId);
    if (member) {
      return await sharePrompt(promptId, { email: member.email, role: newRole, name: member.name });
    }
  };

  // Delete Prompt
  const deletePrompt = async (promptId) => {
    try {
      await promptService.deletePrompt(promptId);
      setPrompts(prev => prev.filter(p => p.id !== promptId));
      if (activePromptId === promptId) {
        const remaining = prompts.filter(p => p.id !== promptId);
        setActivePromptId(remaining.length > 0 ? remaining[0].id : null);
      }
      return { success: true };
    } catch (err) {
      console.error('Delete prompt error:', err);
      throw err;
    }
  };

  // Add Collection
  const addCollection = async ({ name, description, icon, color }) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return { success: false, message: 'Collection name is required.' };

    try {
      const newCol = await collectionService.createCollection({
        name: trimmed,
        description,
        icon,
        color
      });

      setCollections(prev => [...prev, newCol]);
      return { success: true, collection: newCol };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // Update Collection
  const updateCollection = async (collectionId, data) => {
    try {
      const updated = await collectionService.updateCollection(collectionId, data);
      setCollections(prev => prev.map(c => (c.id === collectionId ? updated : c)));
      setPrompts(prev => prev.map(p => {
        const newCols = (p.collections || []).map(c => (c.id === collectionId ? { ...c, name: updated.name } : c));
        const firstCol = newCols[0];
        return {
          ...p,
          collections: newCols,
          collectionId: firstCol ? firstCol.id : null,
          collection: firstCol ? firstCol.name : null
        };
      }));
      return { success: true, collection: updated };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // Delete Collection
  const deleteCollection = async (collectionId) => {
    try {
      await collectionService.deleteCollection(collectionId);
      setCollections(prev => prev.filter(c => c.id !== collectionId));

      setPrompts(prev => prev.map(p => {
        const newCols = (p.collections || []).filter(c => c.id !== collectionId);
        const firstCol = newCols[0];
        return {
          ...p,
          collections: newCols,
          collectionId: firstCol ? firstCol.id : null,
          collection: firstCol ? firstCol.name : null
        };
      }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // Add Prompt to Collection
  const addPromptToCollection = async (collectionId, promptId) => {
    try {
      const res = await collectionService.addPromptToCollection(collectionId, promptId);
      await refreshData();
      return res;
    } catch (err) {
      console.error('addPromptToCollection error:', err);
      throw err;
    }
  };

  // Remove Prompt from Collection
  const removePromptFromCollection = async (collectionId, promptId) => {
    try {
      const res = await collectionService.removePromptFromCollection(collectionId, promptId);
      await refreshData();
      return res;
    } catch (err) {
      console.error('removePromptFromCollection error:', err);
      throw err;
    }
  };

  // Add Category
  const addCategory = (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return { success: false, message: 'Category name cannot be empty.' };
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, message: `Category "${trimmed}" already exists.` };
    }
    setCategories(prev => [...prev, trimmed]);
    return { success: true };
  };

  // Delete Category
  const deleteCategory = (name) => {
    const lower = (name || '').toLowerCase();
    setCategories(prev => prev.filter(c => c.toLowerCase() !== lower));
  };

  // Live Stats
  const totalPrompts = userPrompts.length;
  const totalVersions = userPrompts.reduce((acc, p) => acc + (p.versions?.length || 1), 0);
  const totalFavorites = userFavorites.length;
  const totalTested = userPrompts.reduce((acc, p) => acc + (p.testCount || 0), 0);

  return (
    <PromptContext.Provider value={{
      userPrompts,
      ownedPrompts,
      myPrompts: ownedPrompts,
      sharedPrompts,
      userActivities,
      userFavorites,
      collections,
      categories,
      isLoading,
      backendError,
      refreshData,
      addCategory,
      deleteCategory,
      activePrompt,
      activePromptId,
      setActivePromptId,
      addPrompt,
      updatePrompt,
      addVersion,
      restoreVersion,
      toggleFavorite,
      ratePrompt,
      logPromptTest,
      sharePrompt,
      removeSharedUser,
      updateShareRole,
      deletePrompt,
      addCollection,
      updateCollection,
      deleteCollection,
      addPromptToCollection,
      removePromptFromCollection,
      totalPrompts,
      totalVersions,
      totalFavorites,
      totalTested
    }}>
      {children}
    </PromptContext.Provider>
  );
};

export const usePrompts = () => useContext(PromptContext);
