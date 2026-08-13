# SP: pInsertarIntegracion
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saIntegr`](../tables/saIntegr.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarIntegracion
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarIntegracion]
    (
      @iInte_Num INT ,
      @sdFec_Emis SMALLDATETIME ,
      @iOrde_Num INT ,
      @iMovb_Num INT ,
      @iCo_BenSocial INT = NULL ,
      @sDes_Inte VARCHAR(60) ,
      @sCo_Cont CHAR(12) ,
      @sdFec_Nomi SMALLDATETIME ,
      @bAgrupa BIT = NULL ,
      @bProcesada BIT ,
      @iTipo_Transf INT = 0 ,
      @sConseId01 VARCHAR(20) = NULL ,
      @iConseNu01 INT = 0 ,
      @sConseId02 VARCHAR(20) = NULL ,
      @iConseNu02 INT = 0 ,
      @sConseId03 VARCHAR(20) = NULL ,
      @iConseNu03 INT = 0 ,
      @sConseId04 VARCHAR(20) = NULL ,
      @iConseNu04 INT = 0 ,
      @sConseId05 VARCHAR(20) = NULL ,
      @iConseNu05 INT = 0 ,
      @sConseId06 VARCHAR(20) = NULL ,
      @iConseNu06 INT = 0 ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL
	
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME
            ) ;
	
        INSERT  INTO saIntegr
                ( inte_num, fec_emis, /*orde_num, movb_num,*/ des_inte, campo1,
                  campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, co_us_mo, fe_us_in, fe_us_mo,
                  trasnfe, revisado )
        OUTPUT  Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo
                INTO @TableTimestamp
        VALUES
                ( @iInte_Num, @sdFec_Emis,@sDes_Inte, @scampo1, @scampo2, @scampo3,
                  @scampo4, @scampo5, @scampo6, @scampo7, @scampo8, @sCo_Us_In, @sCo_Us_In, GETDATE(), GETDATE(),
                  @sTrasnfe, @sRevisado )	

        SELECT
            *
        FROM
            @TableTimestamp
    END
```
