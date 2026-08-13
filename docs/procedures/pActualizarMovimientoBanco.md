# SP: pActualizarMovimientoBanco
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)

## Código (excerpt)
```sql
/*************************************************************************************************
*NOMBRE			:	pActualizarMovimientoBanco
*DESCRIPCION	:	Actualiza un registro de la tabla dbo.saMovimientoBanco
*CREADO			:	SOFTECH SISTEMAS
*LAST UPDATE    :   27/07/2020
**************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarMovimientoBanco]
    (
      @sMov_Num CHAR(20) ,
      @sMov_NumOri CHAR(20) ,
      @sDescrip VARCHAR(60) ,
      @sCod_Cta CHAR(6) ,
      @sdFecha SMALLDATETIME ,
      @deTasa DECIMAL(21, 8) ,
      @sTipo_Op CHAR(2) ,
      @sDoc_Num VARCHAR(20) ,
      @deMonto DECIMAL(18, 2) ,
      @sCo_Cta_Ingr_Egr CHAR(20) ,
      @sOrigen CHAR(3) ,
      @sCob_Pag CHAR(20) ,
      @deIDB DECIMAL(18, 2) ,
      @sDep_Num CHAR(20) ,
      @bConciliado BIT ,
      @bAnulado BIT ,
      @bOri_Dep BIT ,
      @iDep_Con INT ,
      @bSaldo_Ini BIT ,
      @sdFec_Con SMALLDATETIME = NULL ,
      @sCod_IngBen CHAR(6) ,
      @sdFecha_Che SMALLDATETIME ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
	  @iNro_Transf_Nomi int = NULL,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 		
    )
AS 
    BEGIN

        DECLARE @deMonto_D DECIMAL(18, 2)
        DECLARE @deMonto_H DECIMAL(18, 2)
		
		IF ( @sTipo_Op IN ( 'CH', 'ND', 'RC', 'TR' ) ) 
            BEGIN
                SET @deMonto_D = @deMonto ;
                SET @deMonto_H = 0 ;
            END
        ELSE 
           IF ( @sTipo_Op = 'ID' )
					BEGIN
						SET @deMonto_D = 0 ;
						SET @deMonto_H = 0 ;
						SET @deIDB = @deMonto ;
					END
				ELSE			
					BEGIN
						SET @deMonto_D = 0 ;
						SET @deMonto_H = @deMonto ;
					END

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
	
        UPDAT
```
