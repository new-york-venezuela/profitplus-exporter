# SP: pActualizarPrecioCostoManual
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saAjPrecioCostoReng`](../tables/saAjPrecioCostoReng.md)
- [`saArtMargen`](../tables/saArtMargen.md)
- [`saArtPrecio`](../tables/saArtPrecio.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pActualizarPrecioCostoManual]
*DESCRIPCIÓN	: Actualizar el precio o costo de un articulo
*AUTOR			: SOFTECH SISTEMAS
*CREACIÓN       : <2013-01-09>
*ACTUALIZACIÓN  : <2020-06-18>
**************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarPrecioCostoManual]
    (
      @sCo_Alma CHAR(6) = NULL ,
      @iTipo_Ajuste INT ,
      @sCo_TipoPrecio CHAR(6) = NULL ,
      @sCo_TipoCosto CHAR(6) = NULL ,

	-- 1 usar el margen 
	-- 2 no tomar en cuenta el margen
	-- 3 no realizar ajuste
      @sMargenInferior CHAR(6) ,
      @sMargenSuperior CHAR(6) ,
      @bOtraMoneda BIT ,
      @sCo_Art CHAR(30) ,
      @dDesde DATETIME ,
      @dHasta DATETIME = NULL ,
      @deMonto DECIMAL(18, 5) ,
      @dCostoBase DECIMAL(18, 5) ,
      @dMontoReal DECIMAL(18, 5) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @sMaquina VARCHAR(60) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
	  -->>JN 202020520
	  ,@sCo_Mone VARCHAR(6) = NULL 
	  ,@sCod_Ajuste CHAR(20) = NULL 
	  ,@iReng_Num INT = NULL
	  --<<JN 202020520  	
    )
AS 
    BEGIN
        DECLARE @MontoVal DECIMAL(18, 5)
        DECLARE @ValorInferior DECIMAL(18, 5)
        DECLARE @ValorSuperior DECIMAL(18, 5)
	     
        DECLARE @ValorMargenI DECIMAL(18, 5)
        DECLARE @ValorMargenS DECIMAL(18, 5)
	    DECLARE @PrecioCosto bit
        DECLARE @RowGuIdArticulo UNIQUEIDENTIFIER
        DECLARE @sCamposI NVARCHAR(70)
        DECLARE @dtFe_In DATETIME
        DECLARE @IdCorrida UNIQUEIDENTIFIER
		DECLARE @PistaMensaje AS VARCHAR(MAX)
		DECLARE @dtFe_De DATETIME
		-->>JN 202020602
		DECLARE @pMensaje AS VARCHAR(MAX)
		--<<JN 202020602
				
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
            
		
		 --Para ajuste de precio
        IF ( @iTipo_Ajuste = 0 ) 
            BEGIN
			    SET @PistaMensaje = (rtrim(@sCo_Art) + ', ' + rtrim(@sCo_Alma) + ', ' + rtrim(@sCo_TipoPrecio) + ', '
```
