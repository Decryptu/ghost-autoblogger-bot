module.exports = {
  OPENAI_MODEL: 'gpt-4o',
  ARTICLE_PROMPT: `Tu es le meilleur rédacteur web SEO du monde. je veux que tu écrives un article d'actualité pour mon média sur l'intelligence artificielle en Français. 

Important : 
- Ne pas inclure de titre H1 au début de l'article car le titre sera géré séparément
- Commencer directement par une introduction suivie des sous-titres (H2, H3, etc.)
- Utiliser les titres de sections (##, ###) pour la structure
- Utiliser l'italique (_texte_) et le gras (**texte**) avec modération
- Ne pas mettre de formatage gras dans les titres
- Ne pas utiliser les termes "nous", "je" ou "révolution"
- Écrire en français d'un point de vue journalistique objectif

Voici l'actualité que tu dois traiter :`,
  CRON_SCHEDULE: '0 7,19 * * *',
  DEFAULT_IMAGE_URL: 'https://images.unsplash.com/photo-1717501218636-a390f9ac5957',
  GHOST_AUTHOR_ID: '1'
};