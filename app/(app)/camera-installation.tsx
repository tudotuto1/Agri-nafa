// =============================================================================
// Comment installer une caméra — manuel de pose.
//
// -----------------------------------------------------------------------------
// POURQUOI CE CONTENU EST EN DUR
//
// Ce texte ne vit pas en base, contrairement aux guides culturaux. Trois
// raisons, dans cet ordre :
//
//   1. On le consulte au champ, en haut d'un mât, sans réseau. Un manuel qui
//      demande une requête au moment où on en a besoin ne sert à rien.
//   2. Il est identique pour tout le monde. Rien à adapter à la spéculation, à
//      la surface ou à la région — donc rien à paramétrer.
//   3. Il ne change qu'avec le matériel. Le jour où le modèle sera arrêté, ce
//      sera une nouvelle version de l'application, pas une ligne à corriger en
//      base.
//
// Les guides culturaux, eux, sont en base parce qu'une dose d'engrais corrigée
// doit atteindre tout de suite des producteurs qui mettent à jour rarement.
// Ici, l'inverse : c'est la disponibilité hors ligne qui prime.
//
// -----------------------------------------------------------------------------
// CE QUE CE MANUEL NE PEUT PAS ÊTRE
//
// Le modèle exact n'est pas choisi. Ces instructions valent pour n'importe
// quelle caméra solaire 4G du marché, et c'est tout ce qu'elles prétendent
// être. La mention en tête le dit avant la première étape, pas en note de bas
// de page : quelqu'un qui suit un couple de serrage ou un sens d'insertion
// donné ici comme certain peut abîmer un boîtier qu'il a payé.
// =============================================================================

import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  Aide,
  Bouton,
  Ecran,
  SousTitre,
  Titre,
} from "@/components/ui";
import {
  SchemaConnecteur,
  SchemaContenu,
  SchemaEmplacement,
  SchemaNumeroSerie,
  SchemaPanneau,
  SchemaSim,
  SchemaVoyants,
} from "@/components/schemas-camera";
import { couleurs, espaces, rayons, textes } from "@/constants/theme";

type Etape = {
  titre: string;
  schema: () => React.ReactElement;
  phrases: string[];
  /** Ce qui abîme le matériel ou ruine l'installation. Omis quand rien ne vaut d'être dit. */
  aEviter?: string;
};

// -----------------------------------------------------------------------------
const ETAPES: Etape[] = [
  {
    titre: "Vérifier le contenu du carton",
    schema: SchemaContenu,
    phrases: [
      "Sortez tout et posez les pièces à plat avant de partir au champ : boîtier, panneau solaire, mât ou fixation, câble, visserie.",
      "Comptez les vis et les colliers. Une pièce manquante se remplace au marché, mais pas en haut d'un poteau.",
    ],
  },
  {
    titre: "Insérer la carte SIM",
    schema: SchemaSim,
    phrases: [
      "Ouvrez le logement, généralement fermé par un capot vissé sur le côté ou le dessous du boîtier.",
      "La carte n'entre que dans un sens : le coin biseauté guide l'insertion, puce vers le bas. Elle doit glisser sans forcer.",
      "Refermez en vérifiant que le joint est bien en place et propre. C'est lui qui tient la pluie dehors.",
    ],
    aEviter:
      "Forcer une SIM qui résiste. Si elle ne rentre pas, c'est qu'elle est dans le mauvais sens — insister tord les contacts et la carte devient inutilisable.",
  },
  {
    titre: "Choisir l'emplacement",
    schema: SchemaEmplacement,
    phrases: [
      "Visez 2,5 à 3 mètres de haut, avec une vue dégagée sur les rangs à surveiller.",
      "Écartez-vous du passage du bétail et des sentiers. Un animal qui se frotte au mât dérègle le cadrage en une nuit.",
      "Regardez aussi ce qui poussera : un manguier en bordure ne gêne pas en janvier et masque tout en juin.",
    ],
    aEviter:
      "Poser la caméra à hauteur d'homme. Elle voit moins de rangs, elle se salit plus vite, et elle part avec le premier passant.",
  },
  {
    titre: "Orienter le panneau solaire",
    schema: SchemaPanneau,
    phrases: [
      "Au Burkina, la face vitrée regarde le sud, inclinée d'environ 15 degrés sur l'horizontale.",
      "Cette inclinaison sert autant à capter le soleil qu'à laisser la pluie laver la poussière — un panneau à plat s'encrasse et perd la moitié de son rendement.",
      "Vérifiez qu'aucune ombre ne passe dessus dans la journée : un seul poteau suffit à faire chuter la charge.",
    ],
    aEviter:
      "Orienter le panneau au nord. Dans l'hémisphère nord, il ne reçoit alors que la lumière rasante : la batterie ne se recharge jamais complètement et la caméra s'éteint au bout de quelques nuits.",
  },
  {
    titre: "Fixer et brancher",
    schema: SchemaConnecteur,
    phrases: [
      "Fixez d'abord le boîtier et le panneau, branchez ensuite : un câble tendu pendant le serrage s'arrache au niveau du connecteur.",
      "Le câble va du panneau vers le boîtier. Serrez la bague à la main jusqu'à la butée, sans pince.",
      "Faites descendre le câble sous gaine et attachez-le au mât tous les 40 centimètres environ.",
    ],
    aEviter:
      "Laisser le câble à nu au sol. Les rongeurs le sectionnent, l'eau entre par la coupure, et la panne se cherche longtemps parce qu'elle ne se voit pas depuis le bas.",
  },
  {
    titre: "Allumer et attendre le voyant",
    schema: SchemaVoyants,
    phrases: [
      "Rouge fixe : la caméra démarre. Vert clignotant : elle cherche le réseau. Vert fixe : elle est en service.",
      "Comptez quelques minutes pour passer du rouge au vert fixe. Ne coupez pas l'alimentation pendant cette recherche.",
      "Si le voyant reste rouge au-delà de dix minutes, voyez la section dépannage plus bas.",
    ],
  },
  {
    titre: "Déclarer la caméra dans AgriNafa",
    schema: SchemaNumeroSerie,
    phrases: [
      "Relevez le numéro de série sur l'étiquette collée sous le boîtier. Notez-le avant de monter au mât : une fois en place, l'étiquette n'est plus lisible.",
      "Enregistrez ensuite la caméra dans l'application et rattachez-la à la parcelle qu'elle surveille.",
    ],
  },
];

// -----------------------------------------------------------------------------
const DEPANNAGE: { probleme: string; causes: string[] }[] = [
  {
    probleme: "Le voyant reste rouge",
    causes: [
      "La carte SIM est mal insérée, ou son capot n'est pas refermé à fond.",
      "La SIM n'a plus de crédit, ou son forfait données n'est pas activé.",
      "L'emplacement ne capte pas la 4G : essayez le même boîtier près d'un endroit où votre téléphone capte, pour distinguer un problème de réseau d'un problème de matériel.",
    ],
  },
  {
    probleme: "Aucune photo reçue",
    causes: [
      "La caméra n'a pas été déclarée dans l'application, ou l'a été avec un numéro de série différent de celui du boîtier.",
      "Le boîtier est en veille faute de charge : vérifiez le niveau de batterie sur sa fiche.",
      "Le câble du panneau est débranché ou sectionné — regardez le connecteur avant tout le reste.",
    ],
  },
  {
    probleme: "La batterie ne tient pas la nuit",
    causes: [
      "Le panneau est sale. La poussière d'harmattan suffit à diviser le rendement : essuyez-le à l'eau claire.",
      "Une ombre passe sur le panneau à certaines heures, ou son orientation n'est pas la bonne.",
      "La cadence de photos est trop rapide pour l'ensoleillement de la saison. Passez à un intervalle plus long depuis la fiche de la caméra.",
    ],
  },
];

// =============================================================================
export default function EcranInstallationCamera() {
  const router = useRouter();

  return (
    <Ecran>
      <Titre>Installer une caméra</Titre>

      {/* Avant la première étape, pas en bas de page : c'est une réserve sur
          tout ce qui suit, et elle doit être lue avant qu'on visse quoi que ce
          soit. */}
      <View style={styles.reserve}>
        <Text style={styles.reserveTitre}>⚠️ Instructions génériques</Text>
        <Text style={styles.reserveTexte}>
          Le modèle de caméra n'est pas encore arrêté. Ces indications valent
          pour une caméra solaire 4G courante, mais la notice du fabricant fera
          foi : suivez-la en priorité partout où elle diffère de ce qui est
          écrit ici.
        </Text>
      </View>

      <Aide>
        Sept étapes, de l'ouverture du carton à la déclaration dans
        l'application. Cette page fonctionne sans réseau : vous pouvez la
        consulter au champ.
      </Aide>

      {ETAPES.map((etape, index) => (
        <BlocEtape key={etape.titre} etape={etape} numero={index + 1} />
      ))}

      <View style={styles.pied}>
        <Bouton
          titre="Déclarer ma caméra"
          onPress={() => router.push("/(app)/cameras")}
        />
      </View>

      {/* --------------------------------------------------------------- */}
      <SousTitre>Si quelque chose ne va pas</SousTitre>

      <View style={styles.liste}>
        {DEPANNAGE.map((cas) => (
          <View key={cas.probleme} style={styles.depannage}>
            <Text style={styles.depannageTitre}>{cas.probleme}</Text>
            <Text style={styles.depannageIntro}>Trois causes probables :</Text>
            {cas.causes.map((cause, i) => (
              <View key={cause} style={styles.cause}>
                <Text style={styles.causeNumero}>{i + 1}</Text>
                <Text style={styles.causeTexte}>{cause}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.pied}>
        <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
      </View>
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
function BlocEtape({ etape, numero }: { etape: Etape; numero: number }) {
  const Schema = etape.schema;

  return (
    <View style={styles.etape}>
      <View style={styles.etapeEntete}>
        <View style={styles.pastille}>
          <Text style={styles.pastilleTexte}>{numero}</Text>
        </View>
        <Text style={styles.etapeTitre}>{etape.titre}</Text>
      </View>

      <View style={styles.schema}>
        <Schema />
      </View>

      {etape.phrases.map((phrase) => (
        <Text key={phrase} style={styles.phrase}>
          {phrase}
        </Text>
      ))}

      {etape.aEviter ? (
        <View style={styles.aEviter}>
          <Text style={styles.aEviterTitre}>À éviter</Text>
          <Text style={styles.aEviterTexte}>{etape.aEviter}</Text>
        </View>
      ) : null}
    </View>
  );
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  liste: { gap: espaces.sm },
  pied: { marginTop: espaces.md, gap: espaces.sm },

  reserve: {
    gap: espaces.xs,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.or,
  },
  reserveTitre: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  reserveTexte: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.encre,
  },

  etape: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  etapeEntete: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
  },
  pastille: {
    width: 38,
    height: 38,
    borderRadius: rayons.rond,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: couleurs.vert,
  },
  pastilleTexte: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.blanc,
  },
  etapeTitre: {
    flex: 1,
    fontSize: textes.sousTitre,
    fontWeight: "700",
    color: couleurs.encre,
  },
  schema: {
    padding: espaces.sm,
    borderRadius: rayons.md,
    backgroundColor: couleurs.papier,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  phrase: {
    fontSize: textes.petit,
    lineHeight: 24,
    color: couleurs.encre,
  },

  aEviter: {
    gap: espaces.xs,
    padding: espaces.sm,
    borderRadius: rayons.sm,
    backgroundColor: couleurs.papier,
    borderLeftWidth: 8,
    borderLeftColor: couleurs.rouge,
  },
  aEviterTitre: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.rouge,
  },
  aEviterTexte: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.encre,
  },

  depannage: {
    gap: espaces.xs,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  depannageTitre: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  depannageIntro: {
    fontSize: textes.petit,
    color: couleurs.attenue,
    marginBottom: espaces.xs,
  },
  cause: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: espaces.sm,
    marginBottom: espaces.xs,
  },
  causeNumero: {
    width: 24,
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.vert,
  },
  causeTexte: {
    flex: 1,
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.encre,
  },
});
