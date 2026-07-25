"""Replace EN_GUIDE data in app.js with full long-dialogue format (12 scenarios)"""
import json

with open('D:/workbuddy/2026-07-22-20-29-18/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '// 导游口语练习数据：按场景组织对话（游客一句 t + 导游一句 g），k=关键短语'
# Also handle case where it was already partially replaced
if start_marker not in content:
    start_marker = '// 导游口语练习数据：长情景对话'

start_idx = content.find(start_marker)
# Find the end: look for "  ];\n  // " after EN_GUIDE
end_search = content.find('  ];\n', start_idx)
# Find the next comment line after that
next_section = content.find('\n  // ', end_search + 1)
end_idx = next_section

print(f"Replacing from {start_idx} to {end_idx} ({end_idx-start_idx} chars)")

NEW_DATA = r'''  // 导游口语练习数据：长情景对话（每个场景多轮来回，像真实带团）
  // 结构：scene=场景名, icon=图标, dialogues=[{role,lines,zh}], keyPhrases=[{en,zh}]
  const EN_GUIDE = [
    {
      scene: '帮客户订酒店', icon: '🏨',
      dialogues: [
        { role:'You',  lines:['Good morning, Mr. Smith!','Have you settled in well?',"How's the hotel?"], zh:['早上好，Smith 先生！','您安顿好了吗？','酒店怎么样？'] },
        { role:'Client',lines:['Good morning! Yes, the room is lovely.','Thank you for arranging it.'], zh:['早上好！是的，房间很棒。','谢谢您安排。'] },
        { role:'You',  lines:["I'm glad you like it. I chose a room with a city view —",'the night scenery here is quite beautiful.'], zh:['很高兴您喜欢。我选了一间有城市景观的房间——','这里的夜景很美。'] },
        { role:'Client',lines:['Oh, I noticed! The skyline at night is stunning.','Great choice!'], zh:['哦，我注意到了！夜晚的天际线太美了。','选得好！'] },
        { role:'You',  lines:['If you need anything — laundry, gym access,','or restaurant recommendations — just let me know.'], zh:['如果您需要任何服务——洗衣、健身房、','或者餐厅推荐——尽管告诉我。'] },
        { role:'Client',lines:['Thank you, I really appreciate it.'], zh:['谢谢，非常感激。'] }
      ],
      keyPhrases:[{en:'settle in',zh:'安顿下来'},{en:'city view',zh:'城市景观'},{en:"I'm happy to help",zh:'我很乐意帮忙'}]
    },
    {
      scene: '机场接机', icon: '✈️',
      dialogues: [
        { role:'You',  lines:["Excuse me, are you Mr. Johnson from Australia?",'Welcome to China! I\'m Yu Ting, your tour guide.'], zh:['请问，您是从澳大利亚来的 Johnson 先生吗？','欢迎来到中国！我是玉婷，您的导游。'] },
        { role:'Client',lines:["Yes, that's me. Nice to meet you!",'Thank you for coming to pick me up.'], zh:['是我，很高兴见到你！','谢谢你来接我。'] },
        { role:'You',  lines:['My pleasure! How was your flight?',"I hope it wasn't too tiring."], zh:['我的荣幸！旅途怎么样？','希望不会太累。'] },
        { role:'Client',lines:['It was long but comfortable. I managed to sleep a bit.'], zh:['挺长的但还算舒服，我睡了一会儿。'] },
        { role:'You',  lines:['Great. Your luggage should be at Belt 7. Let me help you with that. ','Our bus is waiting outside — we\'ll head to the hotel first.'], zh:['很好。您的行李应该在 7 号传送带，我来帮您拿。','我们的大巴在外面等——先去酒店。'] },
        { role:'Client',lines:["Perfect. By the way, what's the weather like here?"], zh:['好的。顺便问一下，这边天气怎么样？'] },
        { role:'You',  lines:["It's warm and sunny today, around 28 degrees.",'Perfect sightseeing weather! Let\'s go.'], zh:['今天温暖晴朗，大概 28 度。','非常适合观光的天气！我们走吧。'] }
      ],
      keyPhrases:[{en:'pick someone up',zh:'接人'},{en:'luggage / baggage',zh:'行李'},{en:'sightseeing',zh:'观光游览'}]
    },
    {
      scene: '景点讲解·古镇', icon: '🏯',
      dialogues: [
        { role:'You',  lines:['Everyone, please gather round. We\'ve arrived at Water Town. ','This town has over 1,000 years of history.'], zh:['各位请聚过来一下。我们到了水镇。','这个小镇有一千多年的历史了。'] },
        { role:'Client',lines:['Wow, look at those stone bridges! They\'re beautiful.'], zh:['哇，看那些石桥！真漂亮。'] },
        { role:'You',  lines:['These are called "arched stone bridges." ','The most famous one is Rainbow Bridge — shall we walk across it?'], zh:['这些叫「拱石桥」。','最有名的是彩虹桥——我们走过去看看？'] },
        { role:'Client',lines:['Yes, please! What are those boats in the canal?'], zh:['好呀！运河里那些船是什么？'] },
        { role:'You',  lines:['Those are traditional wooden boats called wupeng boats. ','Locals used them for fishing and transport. Now they\'re mainly for tourists.'], zh:['那些是传统的木船，叫乌篷船。','当地人以前用来打鱼和运输。现在主要载游客。'] },
        { role:'Client',lines:['Can we take a boat ride later?'], zh:['我们待会儿能坐船吗？'] },
        { role:'You',  lines:['Absolutely! We have a boat ride scheduled at 4 PM. ','It\'s especially magical at sunset — the lanterns light up along the river.'], zh:['当然可以！我们安排了下午 4 点坐船。','日落时特别迷人——沿河的灯笼都会亮起来。'] }
      ],
      keyPhrases:[{en:'gather round',zh:'聚拢过来'},{en:'arched bridge',zh:'拱桥'},{en:'scheduled',zh:'已安排/已排定'}]
    },
    {
      scene: '餐饮推荐·本地菜', icon: '🍜',
      dialogues: [
        { role:'You',  lines:["It's almost lunchtime. Are you hungry? ","I know a great local restaurant nearby."], zh:['快到午饭时间了。你们饿了吗？','我知道附近一家很棒的本地餐馆。'] },
        { role:'Client',lines:["Yes, I'm starving! What do you recommend?"], zh:['饿坏了！你推荐什么？'] },
        { role:'You',  lines:['This region is famous for spicy hot pot and dumplings. ','If you can handle spicy food, the hot pot is a must-try.'], zh:['这个地区以麻辣火锅和饺子闻名。','如果你们能吃辣，火锅一定要试。'] },
        { role:'Client',lines:['I love spicy food! But is there anything... less adventurous?','My wife prefers something mild.'], zh:['我喜欢吃辣！但是有没有……不那么刺激的？','我太太偏好清淡的。'] },
        { role:'You',  lines:['Of course! For mild options, I recommend steamed fish ','with ginger and scallion, or braised pork belly. Both are delicious.'], zh:['当然可以！清淡的话，我推荐清蒸鱼','加姜葱，或者红烧肉。都很好吃。'] },
        { role:'Client',lines:['Sounds perfect. Do they have an English menu?'], zh:['听起来不错。他们有英文菜单吗？'] },
        { role:'You',  lines:['They do, but I can also order for you if you like. ','I\'ll explain each dish before it comes.'], zh:['有的，不过如果您愿意我也可以帮你们点菜。','每道菜上来前我会介绍。'] }
      ],
      keyPhrases:[{en:'must-try',zh:'必尝'},{en:'mild option',zh:'清淡选择'},{en:'braised',zh:'红烧/炖'}]
    },
    {
      scene: '购物陪同·纪念品', icon: '🛍️',
      dialogues: [
        { role:'Client',lines:['I want to buy some souvenirs for my family. Any suggestions?'], zh:['我想给家人买些纪念品。有什么建议吗？'] },
        { role:'You',  lines:['Great idea! This market is famous for silk, tea, and handicrafts. ','Let me show you around.'], zh:['好主意！这个市场以丝绸、茶叶和手工艺品闻名。','我带你们转转。'] },
        { role:'Client',lines:['This silk scarf is beautiful. How much is it?'], zh:['这条丝巾真漂亮。多少钱？'] },
        { role:'You',  lines:['The starting price is 200 yuan, but you can bargain. ','Try offering 120 yuan first — don\'t worry, it\'s expected here.'], zh:['开价是 200 元，不过可以讲价。','先试着出 120 元——别担心，这里都这样。'] },
        { role:'Client',lines:['Really? I feel bad bargaining. Is that rude?'], zh:['真的吗？讲价感觉不太好意思。会不会不礼貌？'] },
        { role:'You',  lines:['Not at all! Bargaining is part of the culture here. ','Shop owners actually enjoy it — just keep it friendly and smile.'], zh:['完全不会！讲价是这里文化的一部分。','店主其实很享受这个过程——保持友好、多笑就行。'] },
        { role:'Client',lines:["Alright, I'll try. Can you help me check if this silk is real?"], zh:['好吧，我试试。你能帮我看看这丝绸是不是真的吗？'] },
        { role:'You',  lines:['Sure. Real silk feels cool to the touch and has a subtle luster. ','Let me show you the authenticity label... Yes, this is genuine.'], zh:['当然。真丝摸起来凉凉的有微妙的光泽。','让我看一下鉴定标签……嗯，这是真的。'] }
      ],
      keyPhrases:[{en:'bargain',zh:'讲价/砍价'},{en:'authenticity',zh:'真实性/正品'},{en:'genuine',zh:'真的/正宗'}]
    },
    {
      scene: '处理游客投诉', icon: '⚠️',
      dialogues: [
        { role:'Client',lines:["I need to speak to you. I'm very unhappy with the hotel."], zh:['我要跟你谈谈。我对这家酒店很不满意。'] },
        { role:'You',  lines:["I'm sorry to hear that. Please tell me what happened, ","and I'll do my best to resolve it."], zh:['听到这个我很抱歉。请告诉我发生了什么，','我会尽力解决。'] },
        { role:'Client',lines:["The air conditioner in my room isn't working, ","and I asked twice but nobody came to fix it."], zh:['我房间空调坏了，','我叫了两次都没人来修。'] },
        { role:'You',  lines:["That's completely unacceptable. I apologize for the inconvenience. ","Let me call the manager right now."], zh:['这完全不能接受。给您带来不便我道歉。','我现在就给经理打电话。'] },
        { role:'You',  lines:["(on phone) Hello, this is the tour guide for Room 1205. ","My guest's AC has been broken for two days. Please send someone immediately."], zh:['（电话中）您好，我是 1205 房间客人的导游。','空调坏了两天了，请立刻派人过来。'] },
        { role:'You',  lines:['The manager apologizes and says a technician will be there in 10 minutes. ','In the meantime, would you like me to arrange a different room?'], zh:['经理道歉了，说技术人员 10 分钟内到。','这期间要不要我帮您换一间房？'] },
        { role:'Client',lines:['Thank you. I appreciate your quick response.'], zh:['谢谢，感谢你这么快处理。'] }
      ],
      keyPhrases:[{en:'resolve a problem',zh:'解决问题'},{en:'inconvenience',zh:'不便'},{en:'quick response',zh:'快速响应'}]
    },
    {
      scene: '紧急情况·医疗', icon: '🏥',
      dialogues: [
        { role:'Client',lines:["Yu Ting... I don't feel well. My stomach hurts badly."], zh:['玉婷……我不舒服。胃很痛。'] },
        { role:'You',  lines:['Oh no! How long have you been feeling this way? ','Did you eat anything unusual today?'], zh:['天哪！这种情况多久了？','今天吃了什么不寻常的东西吗？'] },
        { role:'Client',lines:['It started after lunch. Maybe the street food...'], zh:['午饭后开始的。可能是路边摊……'] },
        { role:'You',  lines:["Don't worry, I'm taking you to the hospital right now. ","There's an international medical center 15 minutes from here."], zh:['别担心，我现在就带你去医院。','离这儿 15 分钟有个国际医疗中心。'] },
        { role:'You',  lines:['(to driver) Please drive to United Family Hospital, as fast as safely possible.'], zh:['（对司机）请开车去和睦家医院，在安全前提下尽快。'] },
        { role:'You',  lines:["We're almost there. The hospital has English-speaking doctors, ","so communication won't be a problem. I'll stay with you the whole time."], zh:['快到了。医院有会说英语的医生，','沟通不会有问题。我会一直陪着您。'] },
        { role:'Client',lines:['Thank you so much. I don\'t know what I\'d do without you.'], zh:['太感谢了。没有你我都不知道该怎么办。'] }
      ],
      keyPhrases:[{en:'international medical center',zh:'国际医疗中心'},{en:'English-speaking doctor',zh:'会英语的医生'},{en:'as fast as safely possible',zh:'安全前提下尽快'}]
    },
    {
      scene: '跨文化·中东客户', icon: '🕌',
      dialogues: [
        { role:'You',  lines:["Mr. Hassan, I'd like to confirm: are there any dietary restrictions ","I should know about for our group meals?"], zh:['Hassan 先生，我想确认一下：团队用餐有什么饮食禁忌','我应该知道的吗？'] },
        { role:'Client',lines:['Yes, thank you for asking. We don\'t eat pork, ','and all meat must be halal.'], zh:['好的，谢谢你问。我们不吃猪肉，','而且所有肉类必须是清真食品。'] },
        { role:'You',  lines:["Understood. I've already arranged halal-certified restaurants for all meals. ","Also, I noticed prayer times — there's a quiet prayer room ","at each venue we're visiting. Would that be helpful?"], zh:['明白了。我已经安排了所有餐食都在清真认证餐厅。','另外，我注意到祷告时间——我们要去的每个景点都有安静的祷告室。这会有帮助吗？'] },
        { role:'Client',lines:["That's very thoughtful of you. Yes, we pray five times a day."], zh:['你想得很周到。是的，我们每天做五次礼拜。'] },
        { role:'Client',lines:['One more thing — in my culture, men and women don\'t usually ','shake hands unless they know each other well.'], zh:['还有一件事——在我的文化里，男女通常','不握手，除非彼此很熟悉。'] },
        { role:'You',  lines:['Thank you for letting me know. I\'ll make sure to respect that ','and brief the other staff as well. Is there anything else?'], zh:['谢谢您告诉我。我会确保尊重这一点','并告知其他工作人员。还有别的吗？'] },
        { role:'Client',lines:["No, that's all. You're very professional."], zh:['没了，就这些。你很专业。'] }
      ],
      keyPhrases:[{en:'dietary restriction',zh:'饮食禁忌'},{en:'halal',zh:'清真'},{en:'prayer room',zh:'祷告室'}]
    },
    {
      scene: '跨文化·日本客户', icon: '🗾',
      dialogues: [
        { role:'You',  lines:['Tanaka-san, welcome! I hope your flight was comfortable.'], zh:['田中先生，欢迎！希望您旅途舒适。'] },
        { role:'Client',lines:['Yes, it was fine. Thank you for having us.'], zh:['还好，谢谢接待。'] },
        { role:'You',  lines:["I've prepared a detailed itinerary for the next five days. ","Please take a look and let me know if you'd like any adjustments."], zh:['我准备了接下来五天的详细行程表。','请过目，有任何想调整的告诉我。'] },
        { role:'Client',lines:['(bowing slightly) Thank you. We appreciate thorough planning.'], zh:['（微微鞠躬）谢谢。我们欣赏周全的计划。'] },
        { role:'You',  lines:["Also, I'd like to mention: in Chinese culture, we often use two hands ","when giving or receiving business cards or gifts. It shows respect."], zh:['另外我想提一下：在中国文化里，递接名片或礼物时常用双手，','这是表示尊重。'] },
        { role:'Client',lines:['Ah, similar to Japan! We also value respect through small gestures.'], zh:['啊，跟日本很像！我们也重视通过小动作表达尊重。'] },
        { role:'You',  lines:['Yes, I think our cultures share many values. One difference though — ','Chinese people may offer food multiple times as hospitality. ','It\'s polite to accept at least a little.'], zh:['是的，我觉得我们文化有很多共同点。不过有一个区别——','中国人可能会多次劝菜表示好客。','至少接受一点是礼貌的。'] },
        { role:'Client',lines:['I see. I\'ll remember that. Arigatou gozaimasu.'], zh:['明白了。我会记住的。非常感谢。'] }
      ],
      keyPhrases:[{en:'itinerary',zh:'行程表'},{en:'thorough',zh:'周全/详尽'},{en:'hospitality',zh:'好客/款待'}]
    },
    {
      scene: '送别客人', icon: '👋',
      dialogues: [
        { role:'You',  lines:["Well, we've arrived at the airport. I can't believe the tour is already over!"], zh:['嗯，到机场了。不敢相信行程已经结束了！'] },
        { role:'Client',lines:['Me neither. These past ten days have been amazing. Thank you for everything.'], zh:['我也是。这十天太精彩了。感谢你所做的一切。'] },
        { role:'You',  lines:['It was my honor to be your guide. You were a wonderful group. ','Did you enjoy the highlights — the Great Wall, the water town, and Peking duck?'], zh:['能当你们的导游是我的荣幸。你们是很棒的团体。','你们喜欢那些亮点吗——长城、水镇、北京烤鸭？'] },
        { role:'Client',lines:['Every single moment! Especially the cooking class — I\'ll definitely make dumplings at home.'], zh:['每一刻都喜欢！尤其是烹饪课——我回家肯定要包饺子。'] },
        { role:'You',  lines:["That's wonderful to hear! Here are some souvenirs from our team — ","a silk fan and some tea. A small token of our appreciation."], zh:['听到这个太好了！这是我们团队的一点纪念品——','一把扇子和一些茶。一点小心意。'] },
        { role:'Client',lines:["Oh, you shouldn't have! This is so thoughtful. Thank you, Yu Ting."], zh:['哦，你们太客气了！太有心了。谢谢你，玉婷。'] },
        { role:'You',  lines:['Safe travels home, and please come back to visit China again! ','Feel free to contact me anytime if you need anything.'], zh:['回家一路平安，欢迎再来中国！','随时联系我，有任何需要都可以找我。'] }
      ],
      keyPhrases:[{en:'highlight',zh:'亮点/精彩部分'},{en:'token of appreciation',zh:'心意/纪念'},{en:'safe travels',zh:'一路平安'}]
    },
    {
      scene: '带团流程·第一天集合', icon: '🚌',
      dialogues: [
        { role:'You',  lines:['Good morning, everyone! Welcome to China. I\'m Yu Ting, your national guide ','for this 8-day tour. Before we set off, let me go through today\'s plan.'], zh:['大家早上好！欢迎来到中国。我是玉婷，你们这次 8 日游的全陪导游。','出发前，我先说一下今天的计划。'] },
        { role:'Client',lines:['Excuse me, where is the restroom on this bus?'], zh:['请问，大巴上的洗手间在哪？'] },
        { role:'You',  lines:["It's at the back of the bus on the right side. Also, there are bottled waters ","and umbrellas in the seat pockets — please take one, it might rain later."], zh:['在车厢后部右侧。座位口袋里有矿泉水','和雨伞——请各取一把，后面可能会下雨。'] },
        { role:'Client',lines:"What time do we arrive at the hotel?", zh:'我们几点到酒店？' },
        { role:'You',  lines:["We'll arrive around 5 PM. Check-in might take 30 minutes, so dinner is at 7. ","Tonight we'll have a welcome dinner with Peking Duck — it's included in your package."], zh:['大概下午 5 点到。入住可能要 30 分钟，所以晚餐 7 点。','今晚有欢迎晚宴吃北京烤鸭——包含在团费里的。'] },
        { role:'Client',lines:'Is WiFi available at the hotel?', zh:'酒店有 WiFi 吗？' },
        { role:'You',  lines:['Yes, free WiFi throughout. I\'ll share the password in our group chat. ','Speaking of which — could everyone please join this WeChat group? ','I\'ll post daily schedules, photos, and any updates there.'], zh:['有，全区域免费 WiFi。密码我会发到群里。','说到这个——请大家加入这个微信群好吗？','我会发每日行程、照片和更新通知。'] }
      ],
      keyPhrases:[{en:'national guide',zh:'全陪导游'},{en:'included in the package',zh:'包含在团费里'},{en:'daily schedule',zh:'每日行程'}]
    },
    {
      scene: '应对刁钻问题', icon: '🤔',
      dialogues: [
        { role:'Client',lines:["I read online that this 'ancient temple' was rebuilt in 2010. Is that true?"], zh:['我在网上看到这座「古庙」是 2010 年重建的。是真的吗？'] },
        { role:'You',  lines:["That's a great question. You're partly correct — ","the original temple dates back 600 years, but it was damaged in an earthquake ","and carefully restored between 2008 and 2010 using traditional methods."], zh:['这个问题问得好。你说对了一部分——','寺庙原件有 600 年历史，但在地震中受损，','于 2008 到 2010 年用传统工艺精心修复。'] },
        { role:'Client',lines:'So it\'s not really "ancient" then?', zh:'那它其实不算「古老」咯？' },
        { role:'You',  lines:["I understand why you'd say that. What makes it special is that ","the restoration used the original architectural drawings and 80% original materials ","recovered from the site. So while the completion date is recent, ","the craftsmanship and spirit truly are ancient."], zh:['我理解你为什么这么说。它的特别之处在于','修复用了原始建筑图纸和现场回收的 80% 原始材料。','所以虽然完工日期较近，但工艺和精神确实是古老的。'] },
        { role:'Client',lines:['Hmm, fair point. I appreciate the honest answer.'], zh:['嗯，说得有道理。感谢你诚实的回答。'] },
        { role:'You',  lines:['Thank you. I always believe tourists deserve accurate information. ','Shall we go inside? The wood carvings are genuinely from the Ming dynasty.'], zh:['谢谢。我一直认为游客应得到准确信息。','我们进去吧？那些木雕确实来自明朝。'] }
      ],
      keyPhrases:[{en:'restoration',zh:'修复/复原'},{en:'craftsmanship',zh:'工艺'},{en:'accurate information',zh:'准确信息'}]
    }
  ];
'''

content = content[:start_idx] + NEW_DATA + content[end_idx:]

with open('D:/workbuddy/2026-07-22-20-29-18/js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
with open('D:/workbuddy/2026-07-22-20-29-18/js/app.js', 'r', encoding='utf-8') as f:
    v = f.read()
scenes = ['帮客户订酒店','机场接机','景点讲解','餐饮推荐','购物陪同','处理游客投诉','紧急情况','跨文化·中东','跨文化·日本','送别客人','带团流程','应对刁钻']
found = sum(1 for s in scenes if s in v)
print(f'Done! Found {found}/{len(scenes)} scenarios')
