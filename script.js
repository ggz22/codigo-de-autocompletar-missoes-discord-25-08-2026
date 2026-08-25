delete window.$;
let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
webpackChunkdiscord_app.pop();

let ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata).exports.A;
let RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getRunningGames).exports.Ay;
let QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest).exports.A;
let ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent).exports.A;
let GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getSFWDefaultChannel).exports.Ay;
let FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.h?.__proto__?.flushWaitQueue).exports.h;
let api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get).exports.Bo;

const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"];

// Filtra apenas missões válidas, aceitas e não concluídas
let quests = [...QuestsStore.quests.values()].filter(x => 
    x.userStatus?.enrolledAt && 
    !x.userStatus?.completedAt && 
    new Date(x.config.expiresAt).getTime() > Date.now() && 
    supportedTasks.find(y => Object.keys((x.config.taskConfig ?? x.config.taskConfigV2).tasks).includes(y))
);

let isApp = typeof DiscordNative !== "undefined";

if (quests.length === 0) {
    console.log("Você não tem nenhuma missão incompleta!");
} else {
    // MAPEAMENTO PRÉVIO INFORMATIVO NO CONSOLE
    const questsData = quests.map((q, index) => {
        const config = q?.config ?? {};
        const taskConfig = config.taskConfig ?? config.taskConfigV2 ?? {};
        const tasks = taskConfig.tasks ?? {};
        const questName = config.messages?.questName ?? `Quest sem nome ${index}`;
        const applicationName = config.messages?.gameTitle ?? "(sem título)";

        const taskEntries = Object.entries(tasks).map(([tName, t]) => {
            return {
                taskName: tName,
                taskType: t?.type ?? tName,
                applicationId: t?.applications?.[0]?.id ?? null,
                secondsNeeded: Number(t?.target ?? 0),
                secondsDone: Number(q?.userStatus?.progress?.[tName]?.value ?? 0),
                applications: t?.applications ?? [],
                externalIds: t?.externalIds ?? []
            };
        });

        return {
            questId: config.id ?? q.id ?? null,
            questName,
            applicationName,
            applicationPublisher: config.messages?.gamePublisher ?? null,
            configVersion: config.configVersion ?? null,
            joinOperator: taskConfig.joinOperator ?? "or",
            tasks: taskEntries
        };
    });
    console.log("Quests encontradas:", questsData);

    // FUNÇÃO EXECUTORA DA FILA DE MISSÕES
    let doJob = function() {
        const quest = quests.pop();
        if (!quest) {
            console.log("Todas as missões aplicáveis foram processadas!");
            return;
        }

        const pid = Math.floor(Math.random() * 30000) + 1000;
        const config = quest?.config;
        const taskConfig = config?.taskConfig ?? config?.taskConfigV2;
        const questName = config?.messages?.questName ?? "(sem nome)";
        const applicationName = config?.messages?.gameTitle ?? "(sem título)";

        // Encontra a tarefa suportada ativa nesta missão
        const taskEntry = Object.entries(taskConfig?.tasks || {}).find(([type]) => supportedTasks.includes(type));

        if (!taskEntry) {
            console.log(`Nenhuma tarefa suportada encontrada para "${questName}". Pulinado...`);
            return doJob();
        }

        const [taskName, task] = taskEntry;
        const applicationId = task?.applications?.[0]?.id ?? null;
        const secondsNeeded = task?.target ?? 0;
        let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;

        console.log(`\n>>> Executando: ${questName} [Progresso Atual: ${secondsDone}/${secondsNeeded}s] <<<`);

        // --- MODO 1: WATCH_VIDEO / WATCH_VIDEO_ON_MOBILE ---
        if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {          
            const speed = 7;
            let completed = false;
            
            let fnVideo = async () => {
                while(true) {
                    const remaining = Math.min(speed, secondsNeeded - secondsDone);
                    await new Promise(resolve => setTimeout(resolve, remaining * 1000));
                    const timestamp = secondsDone + speed;
                    
                    const res = await api.post({
                        url: `/quests/${quest.id}/video-progress`, 
                        body: { timestamp: Math.min(secondsNeeded, timestamp + Math.random()) }
                    });
                    
                    completed = res.body.completed_at != null;
                    secondsDone = Math.min(secondsNeeded, timestamp);
                    
                    if (timestamp >= secondsNeeded) break;
                }
                if (!completed) {
                    await api.post({url: `/quests/${quest.id}/video-progress`, body: {timestamp: secondsNeeded}});
                }
                console.log(`Missão de vídeo "${questName}" concluída!`);
                doJob();
            };
            fnVideo();
            console.log(`Simulando visualização de vídeo para ${questName}.`);

               // --- MODO 2: PLAY_ON_DESKTOP ---
        } else if (taskName === "PLAY_ON_DESKTOP") {
            if (!isApp) {
                console.log("Isso não funciona no navegador. Use o aplicativo desktop do Discord para:", questName);
                doJob();
            } else {
                api.get({ url: `/applications/public?application_ids=${applicationId}` }).then(res => {
                    const appData = res.body ?? {};
                    const appName = appData.name ?? applicationName;
                    
                    const safeName = appName.replace(/[\/\\:*?"<>|]/g, "");
                    const exeName = appData.executables?.find(x => x.os === "win32")?.name?.replace(">", "") ?? safeName;
                    
                    const fakeGame = {
                        cmdLine: `C:\\Program Files\\${appName}\\${exeName}`,
                        exeName,
                        exePath: `c:/program files/${appName.toLowerCase()}/${exeName}`,
                        hidden: false,
                        isLauncher: false,
                        id: applicationId,
                        name: appName,
                        pid,
                        pidPath: [pid],
                        processName: appName,
                        start: Date.now(),
                    };

                    const realGames = RunningGameStore.getRunningGames();
                    const fakeGames = [fakeGame];
                    const realGetRunningGames = RunningGameStore.getRunningGames;
                    const realGetGameForPID = RunningGameStore.getGameForPID;

                    RunningGameStore.getRunningGames = () => fakeGames;
                    RunningGameStore.getGameForPID = (pId) => fakeGames.find(x => x.pid === pId);
                    
                    FluxDispatcher.dispatch({type: "RUNNING_GAMES_CHANGE", removed: realGames, added: [fakeGame], games: fakeGames});
                    
                    let fnPlay = data => {
                        let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress[taskName]?.value ?? 0);
                        console.log(`Progresso do jogo: ${progress}/${secondsNeeded}s`);
                        
                        if (progress >= secondsNeeded) {
                            console.log(`Missão de jogo "${questName}" concluída!`);
                            RunningGameStore.getRunningGames = realGetRunningGames;
                            RunningGameStore.getGameForPID = realGetGameForPID;
                            FluxDispatcher.dispatch({type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: []});
                            FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fnPlay);
                            doJob();
                        }
                    };

                    FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fnPlay);
                    console.log(`Jogo simulado como: ${appName}. Aguarde cerca de ${Math.ceil((secondsNeeded - secondsDone) / 60)} minutos.`);
                }).catch(err => {
                    console.error("Falha ao buscar detalhes do aplicativo do jogo:", err);
                    doJob();
                });
            }  

        // --- MODO 3: STREAM_ON_DESKTOP ---
        } else if (taskName === "STREAM_ON_DESKTOP") {
            if (!isApp) {
                console.log("Isso não funciona no navegador. Use o aplicativo desktop do Discord para:", questName);
                doJob();
            } else {
                let realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
                ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
                    id: applicationId,
                    pid,
                    sourceName: null
                });
                
                let fnStream = data => {
                    let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress[taskName]?.value ?? 0);
                    console.log(`Progresso da transmissão: ${progress}/${secondsNeeded}s`);
                    
                    if (progress >= secondsNeeded) {
                        console.log(`Missão de stream "${questName}" concluída!`);
                        ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
                        FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fnStream);
                        doJob();
                    }
                };
                
                FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fnStream);
                console.log(`Transmissão simulada ativa. Transmita qualquer janela em um canal com +1 pessoa por mais ${Math.ceil((secondsNeeded - secondsDone) / 60)} minutos.`);
            }

        // --- MODO 4: PLAY_ACTIVITY ---
        } else if (taskName === "PLAY_ACTIVITY") {
            const channelId = ChannelStore.getSortedPrivateChannels()?.id ?? Object.values(GuildChannelStore.getAllGuilds()).find(x => x != null && x.VOCAL?.length > 0)?.VOCAL?.channel?.id;
            
            if (!channelId) {
                console.log("Nenhum canal de voz acessível foi encontrado para injetar a atividade.");
                return doJob();
            }
            
            const streamKey = `call:${channelId}:1`;
            
            let fnActivity = async () => {
                console.log(`Simulando atividade em canal para a missão: ${questName}`);
                while(true) {
                    const res = await api.post({url: `/quests/${quest.id}/heartbeat`, body: {stream_key: streamKey, terminal: false}});
                    const progress = res.body?.progress?.[taskName]?.value ?? 0;
                    console.log(`Progresso da atividade: ${progress}/${secondsNeeded}s`);
                    
                    if (progress >= secondsNeeded) {
                        await api.post({url: `/quests/${quest.id}/heartbeat`, body: {stream_key: streamKey, terminal: true}});
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 20 * 1000));
                }
                console.log(`Missão de atividade "${questName}" concluída!`);
                doJob();
            };
            fnActivity();

        // 5. Fallback preventivo caso a taskName seja desconhecida
        } else {
            doJob();
        }
    }; // Fecha a função "let doJob = function() {"

    // Inicia a execução sequencial da fila
    doJob();
} // Fecha o bloco principal "if (quests.length === 0) { ... } else {"

