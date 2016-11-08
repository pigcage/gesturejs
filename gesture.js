


video=document.getElementById('video') //html5 video标签，当前实际画面，不显示在页面
canvas=document.getElementById('canvas') //与vedio等高宽的canvas，前期计算用，不显示在页面
_=canvas.getContext('2d') 
ccanvas=document.getElementById('comp') //绘制识别信息的canvas
c_=ccanvas.getContext('2d')
//开启系统相机，启动检测
navigator.webkitGetUserMedia({audio:false,video:true},function(stream){
	s=stream
	video.src=window.URL.createObjectURL(stream)
	video.addEventListener('play',function(){

			setInterval(dump,1000/25)
		}//采样率，降低可进一步提高性能
	)
},function(){
	console.log('OOOOOOOH! DEEEEENIED!')//初始化报错
})
compression=5//压缩比，越低则轮廓描绘越清晰，但性能降低
width=height=0
function dump(){
	if(canvas.width!=video.videoWidth){
		width=Math.floor(video.videoWidth/compression)
		height=Math.floor(video.videoHeight/compression) //取整关闭子像素渲染，减少资源损耗
		canvas.width=ccanvas.width=width
		canvas.height=ccanvas.height=height
	}//设定展示高宽
	_.drawImage(video,width,0,-width,height)
	draw=_.getImageData(0,0,width,height)
	//c_.putImageData(draw,0,0)
	skinfilter()
	test()	
}

huemin=0.0 //色相
huemax=0.10 
satmin=0.0 //饱和度
satmax=1.0
valmin=0.1 //明度
valmax=1.0
//皮肤滤镜：当前帧逐像素过滤，筛选出颜色接近皮肤色的部分，视为“手”
function skinfilter(){
	skin_filter=_.getImageData(0,0,width,height) //皮肤滤镜，储存从draw帧中取出的像素
	var total_pixels=skin_filter.width*skin_filter.height//像素总量
	var index_value//=total_pixels*4 //信息总量，每个像素包含rbga四个值
	
	var count_data_big_array=0;
	for (var y=0 ; y<height ; y++)
	{
		for (var x=0 ; x<width ; x++)
		{
			index_value = x+y*width
			r = draw.data[count_data_big_array]
			g = draw.data[count_data_big_array+1]
			b = draw.data[count_data_big_array+2]
			a = draw.data[count_data_big_array+3]
            hsv = rgb2Hsv(r,g,b);
            //When the hand is too lose (hsv[0] > 0.59 && hsv[0] < 1.0)
			//Skin Range on HSV values
			//满足条件时，将当前像素写入滤镜，否则滤镜对象中当前像素点置为透明
			if(((hsv[0] > huemin && hsv[0] < huemax)||(hsv[0] > 0.59 && hsv[0] < 1.0))&&(hsv[1] > satmin && hsv[1] < satmax)&&(hsv[2] > valmin && hsv[2] < valmax)){
				skin_filter[count_data_big_array]=r
				skin_filter[count_data_big_array+1]=g
				skin_filter[count_data_big_array+2]=b
				skin_filter[count_data_big_array+3]=a
	        }else{
	        	skin_filter.data[count_data_big_array]=0
				skin_filter.data[count_data_big_array+1]=0
				skin_filter.data[count_data_big_array+2]=0
				skin_filter.data[count_data_big_array+3]=0
	        }
            count_data_big_array=index_value*4;
		}
	}
	draw=skin_filter//滤镜对象覆盖draw,供后续使用
}
//RGB--HSV转换
function rgb2Hsv(r, g, b){
    r = r/255
    g = g/255
    b = b/255;

    var max = Math.max(r, g, b)
    var min = Math.min(r, g, b);

    var h, s, v = max;

    var d = max - min;

    s = max == 0 ? 0 : d / max;

    if(max == min){
        h = 0; // achromatic
    }else{

        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
    	}
   		h /= 6;
   	}

    return [h, s, v];
}

avg_counter=0
avg_canculator=0
totald=0 //变化的像素总数
last=false
thresh=150//阈值，大于此值认为该像素信息变化
down=false
wasdown=false
function test(){
	delt=_.createImageData(width,height)//创建一个图片对象，宽高为canvas宽高
	totald=0
	//跳过第一帧
	if(last!==false){
		var totalx=0
		var totaly=0
		var totaln=delt.width*delt.height //像素数
		var pix=totaln*4; //信息数
		//从后往前遍历对比当前帧和上一帧，识别发生变化的像素，其它置白
		while(pix-=4){
			var d=Math.abs(
				draw.data[pix]-last.data[pix]
			)+Math.abs(
				draw.data[pix+1]-last.data[pix+1]
			)+Math.abs(
				draw.data[pix+2]-last.data[pix+2]
			)
			if(d>thresh){
				delt.data[pix]=160
				delt.data[pix+1]=255
				delt.data[pix+2]=255
				delt.data[pix+3]=255
				totald+=1
				//当前像素坐标点加入到统计数量
				totalx+=((pix/4)%width)
				totaly+=(Math.floor((pix/4)/delt.height))
			}
			else{
				delt.data[pix]=0
				delt.data[pix+1]=0
				delt.data[pix+2]=0
				delt.data[pix+3]=0
			}
		}
	}
	//console.log(totald)
	if(totald){ //避开两次采样到同一帧的情况
		down={
			x:totalx/totald,
			y:totaly/totald,
			d:totald
			//这里做了一个除法，即平均当前帧中所有变化点的位置
			//也就是把移动的所有像素合并为了一个质点
			//当然这也会带来误差
		}
		handledown()
	}
	//将draw存入，并将上面算得的delt放入到结果canvas
	last=draw
	c_.putImageData(delt,0,0)
}
movethresh=0.875//最小响应距离，避免识别一些轻微动作
brightthresh=300 //最小响应像素量
overthresh=1000 //双手事件
//储存上一帧变化信息
function calibrate(){
	wasdown={ 
		x:down.x,
		y:down.y,
		d:down.d
	}
}
avg=0
state=0//States: 0 waiting for gesture, 1 waiting for next move after gesture, 2 waiting for gesture to end

stateText = document.getElementById("state");
stateCount = document.getElementById("count");
count = 0
//事件函数
function handledown(){
	avg=0.875*avg+0.125*down.d//平均噪音量，参考TCP RTT超时算法
	var davg=down.d-avg,good=davg>brightthresh
	switch(state){
		case 0:
			if(good){//Found a gesture, waiting for next move
				console.log('start')
				state=1
				calibrate()
				
			}
			break
		case 2://Wait for gesture to end
			if(!good){//Gesture ended
				console.log('end')
				state=0
			}
			break;
		case 1://Got next move, do something based on direction
			var dx=down.x-wasdown.x,dy=down.y-wasdown.y
			console.log(dx,dy);
			//var dirx=Math.abs(dx)>Math.abs(dy)//水平or垂直方向移动
			var dirx=(Math.abs(dx)-Math.abs(dy))>0
			//console.log(good,davg,avg)
			if(dx<-movethresh&&dirx){			
				stateText.innerHTML= 'right'
				console.log('right')
				Reveal.navigateRight()
			}
			else if(dx>movethresh&&dirx){
				stateText.innerHTML='left'
				console.log('left')
				Reveal.navigateLeft()
			}
			if(dy>movethresh&&!dirx){
				if(davg>overthresh){
					stateText.innerHTML='over up'
					console.log('over up')
					Reveal.navigateUp()
					//Reveal.toggleOverview()
				}
				else{
					stateText.innerHTML='down'
					console.log('down')
					
					Reveal.navigateUp()
				}
			}
			else if(dy<-movethresh&&!dirx){
				if(davg>overthresh){
					stateText.innerHTML='over down'
					console.log('over down')
					Reveal.navigateDown()
					//Reveal.toggleOverview()
				}
				else{
					stateText.innerHTML='up'
					console.log('up')
					Reveal.navigateDown()
				}
			}
			stateCount.innerHTML = ++count;
			state=2
			break
	}
}