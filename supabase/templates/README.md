# E-mails de connexion (Supabase Auth)

Supabase envoie ces e-mails lui-même, par le SMTP Brevo réglé dans le projet.
Leur contenu ne vient pas de Brevo : il se colle dans Supabase →
Authentication → Emails → Templates, un modèle à la fois.

| Modèle Supabase | Objet | Fichier |
| --- | --- | --- |
| Magic link | Ton code de connexion Stayfolio | magic-link.html |
| Confirm signup | Bienvenue sur Stayfolio | confirm-signup.html |
| Reset password | Nouveau mot de passe Stayfolio | reset-password.html |
| Change email address | Confirme ta nouvelle adresse | change-email.html |

`{{ .Token }}` est le code à 6 chiffres que l'app installée sur iPhone demande
(le lien s'ouvre dans Safari, qui ne partage pas la session avec l'app).
Les e-mails envoyés par l'app elle-même (invitation d'un membre, récap
mensuel) sont des modèles Brevo : voir emails/brevo/.
