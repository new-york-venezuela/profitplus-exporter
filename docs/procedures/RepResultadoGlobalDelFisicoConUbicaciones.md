# SP: RepResultadoGlobalDelFisicoConUbicaciones
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAlmacen`](../tables/saAlmacen.md)
- [`saArtUbicacion`](../tables/saArtUbicacion.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saInventarioFisico`](../tables/saInventarioFisico.md)
- [`saResInventario`](../tables/saResInventario.md)
- [`saResInventarioReng`](../tables/saResInventarioReng.md)
- [`saUbicacion`](../tables/saUbicacion.md)

## Código (excerpt)
```sql
/*============================================================
 Author:		SOFTECH SISTEMAS
 Create date:	<10-06-16>
 Description:	<Resultado Global del Fisico con ubicaciones>
 =============================================================*/
CREATE PROCEDURE [dbo].[RepResultadoGlobalDelFisicoConUbicaciones]
	-- Add the parameters for the stored procedure here
    @dCo_Fecha_d SMALLDATETIME = NULL ,
    @dCo_Fecha_h SMALLDATETIME = NULL ,
    @sCo_Alma_d CHAR(6) = NULL ,
    @sCo_Alma_h CHAR(6) = NULL ,
    @sCo_Art_d CHAR(30) = NULL ,
    @sCo_Art_h CHAR(30) = NULL ,
    @sCo_Proc CHAR(4) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,    
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;


        IF ( @sDir IS NULL ) 
            SET @sDir = 'ASC'        
		
        IF @dCo_Fecha_d IS NOT NULL 
            SET @dCo_Fecha_d = dbo.FechaSimple(@dCo_Fecha_d)
        IF @dCo_Fecha_h IS NOT NULL 
            SET @dCo_Fecha_h = dbo.FechaSimple(@dCo_Fecha_h)
	 
        IF @sCo_Proc IS NULL 
            SET @sCo_Proc = 'TODO'
	 
        DECLARE @sCo_Proc2 BIT
	 
        IF @sCo_Proc = 'SIT' 
            SET @sCo_Proc2 = 1
        IF @sCo_Proc = 'NOT' 
            SET @sCo_Proc2 = 0
	 

        SELECT
            F.co_invfisico, F.inicio, F.cierre, R.num_resinv, R.co_alma,
			AL.des_alma,  R.fecha,
			A.co_art, A.art_des, RR.co_uni uni , RR.total_art,
			Ub1.co_ubicacion, Ub1.des_ubicacion, Ub2.co_ubicacion, Ub2.des_ubicacion, Ub3.co_ubicacion, Ub3.des_ubicacion, AU.orden
        FROM
            saInventarioFisico F
            JOIN saResInventario R ON R.co_invfisico = F.co_invfisico
			JOIN saResInventarioReng RR ON RR.num_resinv = R.num_resinv
            JOIN saArticulo A ON RR.co_art = A.co_art
			LEFT JOIN saArtUbicacion AU ON AU.co_art = RR.co_art and au.co_alma = r.co_alma
			LEFT JOIN saUbicacion Ub1 ON AU.co_ubicacion = Ub1.co_ubicacion
			LEFT JOIN saUbicacion Ub2 ON AU.co_ubicacion2 = Ub2.co_ubicacion
			LEFT JOIN saUbicacion Ub3 ON AU.co_ubicacion3 = Ub3.co_ubicacion
			JOIN saAlmacen AL ON AL.co_alma = R.co_alma
        WHERE
            ( ( @dCo_Fecha_d IS NULL
                OR dbo.FechaSimple(R.fecha) >= @dCo_Fecha_d
              )
              AND ( @dCo_Fecha_h IS NULL
                    OR dbo.FechaSimple(R.fecha) <= @dCo_Fecha_h
                  )
            )
            AND ( ( @sCo_Alma_d IS NULL
                    OR AL.co_alma >
```
