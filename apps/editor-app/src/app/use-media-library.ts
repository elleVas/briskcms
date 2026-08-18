import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deleteMedia as apiDeleteMedia,
  uploadMedia as apiUploadMedia,
} from '../lib/media-api-client.js';

// Same split as usePagesList: fetching the list is the route loader's job
// (see routes/_shell.media.index.tsx), this hook only owns the actions
// available from a media grid — upload, delete — wherever that grid is
// rendered (the full Media section or the in-editor picker dialog).
export function useMediaLibrary(siteId: string) {
  const queryClient = useQueryClient();

  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['media', siteId] }),
    [queryClient, siteId],
  );

  const uploadMutation = useMutation({
    mutationFn: (file: File) => apiUploadMedia(siteId, file),
    onSuccess: invalidateList,
  });

  const deleteMutation = useMutation({
    mutationFn: (mediaId: string) => apiDeleteMedia(mediaId),
    onSuccess: invalidateList,
  });

  return {
    uploadMedia: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    deleteMedia: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
