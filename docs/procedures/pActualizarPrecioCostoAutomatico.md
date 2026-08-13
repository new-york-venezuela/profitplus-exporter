# SP: pActualizarPrecioCostoAutomatico
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtPrecio`](../tables/saArtPrecio.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pActualizarPrecioCostoAutomatico]
*CREADO			: <2013-01-08>
*MODIFICADO		: <2020-07-01>
*DESCRIPCIÓN	: Actualizar el precio o costo de un articulo automatico
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarPrecioCostoAutomatico]
    (
      @sPrecio_OM BIT ,
      @sCo_Alma CHAR(6) = NULL ,
      @iTipo_Ajuste INT ,
      @sCo_TipoPrecio CHAR(6) = NULL ,
      @sCo_TipoCosto CHAR(6) = NULL ,
      @sCo_Art CHAR(30) ,
      @dDesde DATETIME ,
      @dHasta DATETIME = NULL ,
      @deMonto DECIMAL(18, 5) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @gRowguid UNIQUEIDENTIFIER = NULL  ,
      @sMaquina VARCHAR(60) = NULL
	  -->>JN 20200626
	  , @sCo_Mone CHAR(6) = NULL
	  ,@sCod_Ajuste CHAR(20) = NULL
	  --<<JN 20200626
    )
AS 
    BEGIN
        DECLARE @RowGuIdArticulo UNIQUEIDENTIFIER	
        DECLARE @sCamposI NVARCHAR(70)
        DECLARE @dtFe_In DATETIME
        DECLARE @IdCorrida UNIQUEIDENTIFIER		
        DECLARE @PistaMensaje AS VARCHAR(MAX)
		-->>JN 20200626
		DECLARE @dtFe_De DATETIME
		DECLARE @pMensaje AS VARCHAR(MAX)
		--<<JN 20200626
        DECLARE @TableTimestamp TABLE
              (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER,
              co_art char(30),
              monto DEcimal(18,5),
              co_alma char(6) ,
              co_us_in CHAR(6) ,
              co_sucu_in CHAR(6)  
            )
        
         
        IF ( @iTipo_Ajuste = 0 ) 
            BEGIN
			     SET   @PistaMensaje = (rtrim(@sCo_Art) + ', ' + rtrim(ISNULL(@sCo_Alma, ' ')) + ', ' + rtrim(@sCo_TipoPrecio) + ', ' + CONVERT(NVARCHAR(50), @dDesde, 120) + ', ' + ISNULL(CONVERT(nVarchar(50), @dHasta, 120), 'NULL') + ', ' + CONVERT(NVARCHAR(50), @deMonto, 103) + ', P')
     
			   
                INSERT  INTO saArtPrecio
                        ( co_art, co_alma, co_precio, desde, hasta, monto, precioom, co_us_in, co_sucu_in, fe_us_in,
                          co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe
						  -->>JN 20200626
						  , co_mone
						  --<<JN 20200626
						   )
                  OUTPUT  Inserted.validador,
```
