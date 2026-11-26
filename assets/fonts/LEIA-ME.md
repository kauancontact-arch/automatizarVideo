# Fontes

O container nao tem fonte alguma instalada: `drawtext` e `subtitles` falham sem
elas, e o erro nao diz que o problema e esse.

Baixe e versione aqui:

- **Anton** — https://fonts.google.com/specimen/Anton (OFL)
- **Montserrat** — https://fonts.google.com/specimen/Montserrat (OFL)

Os arquivos `.ttf` ficam nesta pasta. O nome em `Fontname` dentro do template
precisa bater com o nome interno da fonte, nao com o nome do arquivo.

Conferir o que o FFmpeg enxerga:

```bash
fc-list : family | sort -u
```
