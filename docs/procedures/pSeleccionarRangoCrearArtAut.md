# SP: pSeleccionarRangoCrearArtAut
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saCatArticulo`](../tables/saCatArticulo.md)
- [`saColor`](../tables/saColor.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saProcedencia`](../tables/saProcedencia.md)
- [`saSubLinea`](../tables/saSubLinea.md)
- [`saUbicacion`](../tables/saUbicacion.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: PSeleccionarRangoCrearArtAut
*DESCRIPCIÓN	: actualiza una plantilla de generación de Artículos
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 

CREATE PROCEDURE [dbo].[pSeleccionarRangoCrearArtAut]
    (      
      @sCo_Lin_Desde CHAR(6) = NULL ,
      @sCo_Subl_Desde CHAR(6)  = NULL,
      @sCo_Cat_Desde CHAR(6)  = NULL,
      @sCo_Color_Desde CHAR(6)  = NULL,
      @sCo_Ubicacion_Desde CHAR(6)  = NULL,         
      @sCo_Proc_Desde CHAR(6)  = NULL,  
      @sCo_Lin_Hasta CHAR(6)  = NULL,
      @sCo_Subl_Hasta CHAR(6)  = NULL,
      @sCo_Cat_Hasta CHAR(6)  = NULL,
      @sCo_Color_Hasta CHAR(6)  = NULL,
      @sCo_Ubicacion_Hasta CHAR(6) = NULL ,       
      @sCo_Proc_Hasta CHAR(6)  = NULL , 
      @bUsar_Cod_artLin BIT ,
      @bUsar_Cod_artSubl BIT ,
      @bUsar_Cod_artCat BIT ,
      @bUsar_Cod_artColor BIT ,
      @bUsar_Cod_artUbicacion BIT ,
      @bUsar_Cod_artProc BIT   
    )
AS 
		BEGIN	

        select 'saLineaArticulo' as Nombre, co_lin as Cod, lin_des as descr, null as padre from saLineaArticulo        
        
        where (@bUsar_Cod_artLin = 0 AND co_lin = @sCo_Lin_Desde) 
        OR (@bUsar_Cod_artLin = 1 
				AND 
				(
					(@sCo_Lin_Desde is NULL OR  co_lin >= @sCo_Lin_Desde)
				
					AND (@sCo_Lin_Hasta is NULL OR  co_lin <= @sCo_Lin_Hasta)
				 )
			)
		
		
		
		
		
		union
		select 'saCatArticulo' as Nombre, co_cat  as Cod, cat_des as descr, null as padre from saCatArticulo where (@bUsar_Cod_artCat = 0 AND co_cat = @sCo_Cat_Desde) 
        OR (@bUsar_Cod_artCat = 1 
				AND 
				(
					(@sCo_Cat_Desde is NULL OR  co_cat >= @sCo_Cat_Desde)
				
					AND (@sCo_Cat_Hasta is NULL OR  co_cat <= @sCo_Cat_Hasta)
				 )
			)
			
		union
		select 'saSubLinea' as Nombre, co_subl  as Cod, subl_des as descr, co_lin as padre from saSubLinea where (@bUsar_Cod_artsubl = 0 AND co_subl = @sCo_subl_Desde) 
        OR (@bUsar_Cod_artsubl = 1 
				AND 
				(
					(@sCo_subl_Desde is NULL OR  co_subl >= @sCo_subl_Desde)
				
					AND (@sCo_subl_Hasta is NULL OR  co_subl <= @sCo_subl_Hasta)
				 )
			)
		union
		select 'saUbicacion' as Nombre, co_ubicacion  as Cod, des_ubicacion as descr, null as padre from saUbicacion where (@bUsar_Cod_artubicacion = 0 AND co_ubicacion = @sCo_ubicacion_Desde) 
        OR (@bUsar_Cod_artubicacion = 1
```
