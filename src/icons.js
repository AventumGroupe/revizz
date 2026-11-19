// Icônes au trait (Lucide), intégrées à l'appli : pas d'emoji dans l'interface, rendu net et cohérent.
import {
  House, LayoutGrid, CalendarDays, Settings, Plus, Camera, Images, FileText, Files, ChevronLeft, ChevronRight, ArrowRight,
  Trash2, Pencil, Flame, Layers, ListChecks, FilePenLine, MessageCircle, BookOpen, Play, RotateCcw, Shuffle, Check, X,
  Target, Flag, TrendingUp, Link2, Lightbulb, Download, Upload, Leaf, KeyRound, GraduationCap, Clock, CalendarPlus,
  CircleCheck, Send, Info, RefreshCw, GitMerge, BookOpenText, Sigma, Globe, Scale, ChartColumn, Sprout, FlaskConical,
  Monitor, Languages, Microscope, Brain, Map, CodeXml, Wrench, ScrollText, Landmark, Palette, Music, Trophy, Cog, Folder,
  ListTodo, CirclePlus, Undo2, Bell, Hourglass, Award, Eye, BookMarked, Repeat, Sparkle, User, NotebookPen, Calendar,
} from "lucide";

const ICONES = {
  accueil: House, matieres: LayoutGrid, planning: CalendarDays, reglages: Settings, plus: Plus, camera: Camera,
  galerie: Images, page: FileText, pages: Files, retour: ChevronLeft, suite: ChevronRight, fleche: ArrowRight,
  supprimer: Trash2, modifier: Pencil, serie: Flame, cartes: Layers, qcm: ListChecks, sujet: FilePenLine, prof: MessageCircle,
  resume: BookOpen, jouer: Play, refaire: RotateCcw, melanger: Shuffle, ok: Check, fermer: X, depart: Target, final: Flag,
  progres: TrendingUp, lien: Link2, astuce: Lightbulb, telecharger: Download, envoyer: Upload, eco: Leaf, cle: KeyRound,
  eleve: GraduationCap, heure: Clock, controle: CalendarPlus, fait: CircleCheck, send: Send, info: Info, actualiser: RefreshCw,
  fusion: GitMerge, livre: BookOpenText, maths: Sigma, globe: Globe, balance: Scale, graphique: ChartColumn, pousse: Sprout,
  fiole: FlaskConical, ecran: Monitor, langues: Languages, microscope: Microscope, cerveau: Brain, carte: Map, code: CodeXml,
  outil: Wrench, parchemin: ScrollText, monument: Landmark, palette: Palette, musique: Music, trophee: Trophy, engrenage: Cog,
  dossier: Folder, taches: ListTodo, ajouter: CirclePlus, annuler: Undo2, rappel: Bell, sablier: Hourglass, medaille: Award,
  voir: Eye, vocabulaire: BookMarked, repeter: Repeat, etoile: Sparkle, profil: User, copie: NotebookPen, calendrier: Calendar,
};

const attrs = (o) => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(" ");

/** SVG d'une icône, prêt à insérer dans du HTML. */
export function ic(nom, taille = 20, cls = "") {
  const noeuds = ICONES[nom];
  if (!noeuds) return "";
  return `<svg class="ic ${cls}" width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${noeuds
    .map(([tag, a]) => `<${tag} ${attrs(a)}/>`)
    .join("")}</svg>`;
}
