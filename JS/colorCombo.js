
$(document).on('click', '.colorless', function() {      
    $('.color').prop('checked', false);      
    });

    $(document).on('click', '.color', function() {      
        $('.colorless').prop('checked', false);      
    });

    $(document).on('click', '.dropdown-sub', function() {      
        $('.dropdown-sub').not(this).prop('checked', false);      
    });



 $(document).ready(function(){
			$('.mana input[type=checkbox]').click(function(){
                var mList = "";
                var mVal;
                if (this.value == 'c') {
                    mVal = (this.checked ? this.value : "")
                    mList += (mList=="" ? mVal : mVal);
                }
                else {
                
                $('.color').each(function () {
                mVal = (this.checked ? this.value : "");
                    mList += (mList=="" ? mVal : mVal);
                });
                
                }
                
                if ((mList !== "")) {
                    $('#explore').removeAttr('disabled');
                } 
                else {$('#explore').attr('disabled', 'disabled');} 
                            

                $('#combination-name').html(combinations[mList]);
             console.log (mList);
		});    
    });







var combinations  = {
    
        w: "White",
        u: "Blue",
        b: "Black",
        r: "Red",
        g: "Green",
        c: "Colorless",
        wu: "Azorius",
        ub: "Dimir",
        br: "Rakdos",
        rg: "Gruul",
        wg: "Selesnya",
        wb: "Orzhov",
        ur: "Izzet",
        bg: "Golgari",
        wr: "Boros",
        ug: "Simic",
        wub: "Esper",
        ubr: "Grixis",
        brg: "Jund",
        wrg: "Naya",
        wug: "Bant",
        wbg: "Abzan",
        wur: "Jeskai",
        ubg: "Sultai",
        wbr: "Mardu",
        urg: "Temur",
        wubr: "Yore-Tiller",
        ubrg: "Glint-Eye",
        wbrg: "Dune-Brood",
        wurg: "Ink-Treader",
        wubg: "Witch-Maw",
        wubrg: "All colors"
    
     }
