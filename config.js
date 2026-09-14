// ---------------------------------------------------------------------------
// Registro de projetos. Para adicionar um projeto novo, basta acrescentar um
// objeto neste array — nenhuma outra parte do app precisa mudar.
// ---------------------------------------------------------------------------

const PROJETOS = [
  {
    id: "automotivo",
    nome: "Dashboard Automotivo",
    icone: "🚗",
    tipo: "automotivo",
    firebaseBase: "https://dashboard-automotivo-default-rtdb.firebaseio.com",
    caminho: "veiculo", // .json é acrescentado automaticamente
    campoAtualizadoEm: "atualizado_em",
    // Limites usados pra colorir os valores (ajuste como quiser)
    limites: {
      tempMotor: { atencao: 100, critico: 110 }, // °C
      combustivel: { atencao: 15, critico: 5 }, // % (abaixo do valor = alerta)
    },
  },
  {
    id: "irrigacao",
    nome: "Irrigação",
    icone: "💧",
    tipo: "irrigacao",
    // Ainda não está ao vivo — troque por null pra false assim que o projeto
    // Firebase da irrigação estiver criado, e preencha a URL abaixo.
    ativo: false,
    firebaseBase: null, // ex: "https://irrigacao-default-rtdb.firebaseio.com"
    caminho: "irrigacao",
    campoAtualizadoEm: "atualizado_em",
  },
  {
    id: "pcb",
    nome: "Placas (PCB)",
    icone: "🛠️",
    tipo: "status-estatico",
    itens: [
      {
        nome: "ESP32_Rele_Automotivo (Placa Mãe)",
        status: "Controle/lógica — layout fechado em cobre 1oz",
        detalhe: "Backup em 2oz guardado",
      },
      {
        nome: "Placa de Potência",
        status: "Roteamento pendente",
        detalhe: "Recebe 12V e alimenta a placa mãe; driver de relés ULN2803A",
      },
      {
        nome: "Case impresso (PETG)",
        status: "Medidas definidas — 150×100×1,6mm",
        detalhe: "Janela de acesso ao porta-fusível na tampa",
      },
    ],
  },
];

// Intervalo de atualização automática das telas de dados (ms)
const INTERVALO_ATUALIZACAO = 15000;
